from dateutil.relativedelta import relativedelta

from odoo import api, fields, models
from odoo.exceptions import AccessError


class CisneDashboard(models.AbstractModel):
    _name = "cisne.dashboard"
    _description = "Cisne Rondônia Executive Dashboard"

    def _month_bounds(self, month_start):
        next_month = month_start + relativedelta(months=1)
        return month_start, next_month

    def _sum_read_group(self, model_name, domain, field_name):
        model = self.env[model_name]
        rows = model.read_group(domain, [f"{field_name}:sum"], [])
        if not rows:
            return 0.0
        return float(rows[0].get(field_name) or 0.0)

    def _purchase_total_company_currency(self, domain):
        company = self.env.company
        total = 0.0
        orders = self.env["purchase.order"].search(domain)
        for order in orders:
            order_date = fields.Date.to_date(order.date_order) or fields.Date.context_today(self)
            total += order.currency_id._convert(
                order.amount_total,
                company.currency_id,
                company,
                order_date,
            )
        return float(total)

    def _month_series(self):
        company = self.env.company
        today = fields.Date.context_today(self)
        current_month = today.replace(day=1)
        series = []
        for offset in range(7, -1, -1):
            start = current_month - relativedelta(months=offset)
            end = start + relativedelta(months=1)

            invoice_domain = [
                ("company_id", "=", company.id),
                ("state", "=", "posted"),
                ("move_type", "in", ["out_invoice", "out_refund"]),
                ("invoice_date", ">=", start),
                ("invoice_date", "<", end),
            ]
            purchase_domain = [
                ("company_id", "=", company.id),
                ("state", "in", ["purchase", "done"]),
                ("date_order", ">=", fields.Datetime.to_string(start)),
                ("date_order", "<", fields.Datetime.to_string(end)),
            ]

            billed = self._sum_read_group(
                "account.move", invoice_domain, "amount_total_signed"
            )
            purchased = self._purchase_total_company_currency(purchase_domain)
            series.append(
                {
                    "key": start.strftime("%Y-%m"),
                    "label": start.strftime("%m/%Y"),
                    "billed": billed,
                    "purchased": purchased,
                }
            )
        return series

    def _percent_delta(self, current, previous):
        if not previous:
            return None
        return ((current - previous) / abs(previous)) * 100.0

    def _top_clients(self, month_start, month_end):
        company = self.env.company
        domain = [
            ("company_id", "=", company.id),
            ("state", "=", "posted"),
            ("move_type", "in", ["out_invoice", "out_refund"]),
            ("invoice_date", ">=", month_start),
            ("invoice_date", "<", month_end),
        ]
        rows = self.env["account.move"].read_group(
            domain,
            ["partner_id", "amount_total_signed:sum"],
            ["partner_id"],
            lazy=False,
        )
        result = []
        for row in rows:
            partner = row.get("partner_id")
            if not partner:
                continue
            value = float(row.get("amount_total_signed") or 0.0)
            result.append({"id": partner[0], "name": partner[1], "value": value})
        return sorted(result, key=lambda item: item["value"], reverse=True)[:5]

    def _top_products(self, month_start, month_end):
        company = self.env.company
        domain = [
            ("company_id", "=", company.id),
            ("move_id.company_id", "=", company.id),
            ("move_id.state", "=", "posted"),
            ("move_id.move_type", "in", ["out_invoice", "out_refund"]),
            ("move_id.invoice_date", ">=", month_start),
            ("move_id.invoice_date", "<", month_end),
            ("product_id", "!=", False),
        ]
        rows = self.env["account.move.line"].read_group(
            domain,
            ["product_id", "balance:sum"],
            ["product_id"],
            lazy=False,
        )
        result = []
        for row in rows:
            product = row.get("product_id")
            if not product:
                continue
            value = -float(row.get("balance") or 0.0)
            result.append({"id": product[0], "name": product[1], "value": value})
        return sorted(result, key=lambda item: item["value"], reverse=True)[:5]

    def _fsm_stages(self):
        company = self.env.company
        rows = self.env["fsm.order"].read_group(
            [("company_id", "=", company.id)],
            ["stage_id"],
            ["stage_id"],
            lazy=False,
        )
        result = []
        for row in rows:
            stage = row.get("stage_id")
            if not stage:
                continue
            count = int(row.get("stage_id_count") or row.get("__count") or 0)
            result.append({"id": stage[0], "name": stage[1], "count": count})
        return sorted(result, key=lambda item: item["count"], reverse=True)

    def _recent_activity(self):
        company = self.env.company
        items = []

        def append_records(model_name, domain, fields_list, kind, title_prefix, subtitle_field):
            records = self.env[model_name].search_read(
                domain,
                fields_list,
                limit=4,
                order="create_date desc",
            )
            for record in records:
                subtitle_value = record.get(subtitle_field)
                if isinstance(subtitle_value, (list, tuple)):
                    subtitle_value = subtitle_value[1]
                items.append(
                    {
                        "id": record["id"],
                        "model": model_name,
                        "kind": kind,
                        "title": f"{title_prefix} {record.get('name') or record.get('display_name') or ''}".strip(),
                        "subtitle": subtitle_value or "",
                        "date": record.get("create_date"),
                    }
                )

        append_records(
            "sale.order",
            [("company_id", "=", company.id)],
            ["name", "partner_id", "create_date"],
            "sale",
            "Venda",
            "partner_id",
        )
        append_records(
            "purchase.order",
            [("company_id", "=", company.id)],
            ["name", "partner_id", "create_date"],
            "purchase",
            "Compra",
            "partner_id",
        )
        append_records(
            "fsm.order",
            [("company_id", "=", company.id)],
            ["name", "location_id", "create_date"],
            "service",
            "OS",
            "location_id",
        )
        append_records(
            "account.move",
            [
                ("company_id", "=", company.id),
                ("move_type", "in", ["out_invoice", "out_refund"]),
            ],
            ["name", "partner_id", "create_date"],
            "invoice",
            "Fatura",
            "partner_id",
        )

        items = [item for item in items if item.get("date")]
        items.sort(key=lambda item: item["date"], reverse=True)
        return items[:8]

    @api.model
    def get_dashboard_data(self):
        company = self.env.company
        today = fields.Date.context_today(self)
        month_start = today.replace(day=1)
        month_end = month_start + relativedelta(months=1)

        try:
            series = self._month_series()
            current_billed = series[-1]["billed"] if series else 0.0
            previous_billed = series[-2]["billed"] if len(series) > 1 else 0.0
            current_purchased = series[-1]["purchased"] if series else 0.0
            previous_purchased = series[-2]["purchased"] if len(series) > 1 else 0.0

            product_count = self.env["product.product"].search_count(
                [
                    ("active", "=", True),
                    "|",
                    ("company_id", "=", False),
                    ("company_id", "=", company.id),
                ]
            )
            open_fsm_count = self.env["fsm.order"].search_count(
                [
                    ("company_id", "=", company.id),
                    ("stage_id.is_closed", "=", False),
                ]
            )

            return {
                "company_name": company.name,
                "currency": company.currency_id.name,
                "today": fields.Date.to_string(today),
                "kpis": {
                    "billed": {
                        "value": current_billed,
                        "delta": self._percent_delta(current_billed, previous_billed),
                    },
                    "purchased": {
                        "value": current_purchased,
                        "delta": self._percent_delta(current_purchased, previous_purchased),
                    },
                    "products": {"value": product_count},
                    "open_service_orders": {"value": open_fsm_count},
                },
                "series": series,
                "service_stages": self._fsm_stages(),
                "top_clients": self._top_clients(month_start, month_end),
                "top_products": self._top_products(month_start, month_end),
                "recent_activity": self._recent_activity(),
            }
        except AccessError:
            return {
                "company_name": company.name,
                "currency": company.currency_id.name,
                "today": fields.Date.to_string(today),
                "access_limited": True,
                "kpis": {},
                "series": [],
                "service_stages": [],
                "top_clients": [],
                "top_products": [],
                "recent_activity": [],
            }

    @api.model
    def global_search(self, term):
        term = (term or "").strip()
        if len(term) < 2:
            return []

        company = self.env.company
        specs = [
            ("res.partner", [("name", "ilike", term)], ["name"], "Cliente", None),
            (
                "sale.order",
                [("company_id", "=", company.id), ("name", "ilike", term)],
                ["name", "partner_id"],
                "Venda",
                "partner_id",
            ),
            (
                "purchase.order",
                [("company_id", "=", company.id), ("name", "ilike", term)],
                ["name", "partner_id"],
                "Compra",
                "partner_id",
            ),
            (
                "fsm.order",
                [("company_id", "=", company.id), ("name", "ilike", term)],
                ["name", "location_id"],
                "OS",
                "location_id",
            ),
            (
                "contract.contract",
                [("company_id", "=", company.id), ("name", "ilike", term)],
                ["name", "partner_id"],
                "Contrato",
                "partner_id",
            ),
        ]
        results = []
        for model_name, domain, field_names, kind, subtitle_field in specs:
            try:
                records = self.env[model_name].search_read(
                    domain, field_names, limit=5, order="write_date desc"
                )
            except AccessError:
                continue
            for record in records:
                subtitle = record.get(subtitle_field) if subtitle_field else ""
                if isinstance(subtitle, (list, tuple)):
                    subtitle = subtitle[1]
                results.append(
                    {
                        "id": record["id"],
                        "model": model_name,
                        "kind": kind,
                        "title": record.get("name") or record.get("display_name") or "",
                        "subtitle": subtitle or "",
                    }
                )
        return results[:15]
