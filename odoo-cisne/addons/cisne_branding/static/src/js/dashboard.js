/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

const SECTION_ACTIONS = {
    sales: { name: "Vendas", res_model: "sale.order", views: [[false, "list"], [false, "form"]] },
    purchase: { name: "Compras", res_model: "purchase.order", views: [[false, "list"], [false, "form"]] },
    stock: { name: "Estoque", res_model: "product.product", views: [[false, "list"], [false, "form"]] },
    service: { name: "Ordens de Serviço", res_model: "fsm.order", views: [[false, "list"], [false, "form"]] },
    contracts: { name: "Contratos", res_model: "contract.contract", views: [[false, "list"], [false, "form"]] },
    projects: { name: "Projetos", res_model: "project.project", views: [[false, "kanban"], [false, "list"], [false, "form"]] },
    finance: {
        name: "Financeiro",
        res_model: "account.move",
        views: [[false, "list"], [false, "form"]],
        domain: [["move_type", "in", ["out_invoice", "out_refund", "in_invoice", "in_refund"]]],
    },
    accounting: {
        name: "Contabilidade",
        res_model: "account.move",
        views: [[false, "list"], [false, "form"]],
        domain: [["state", "=", "posted"]],
    },
    fiscal: { name: "Fiscal (Brasil)", res_model: "l10n_br_fiscal.document", views: [[false, "list"], [false, "form"]] },
    maintenance: { name: "Ativos e Manutenção", res_model: "maintenance.equipment", views: [[false, "list"], [false, "form"]] },
    fleet: { name: "Frota", res_model: "fleet.vehicle", views: [[false, "kanban"], [false, "list"], [false, "form"]] },
    hr: { name: "Recursos Humanos", res_model: "hr.employee", views: [[false, "kanban"], [false, "list"], [false, "form"]] },
    timesheets: { name: "Timesheets", res_model: "account.analytic.line", views: [[false, "list"], [false, "form"]] },
};

export class CisneDashboard extends Component {
    static template = "cisne_branding.CisneDashboard";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({
            loading: true,
            error: null,
            data: { kpis: {}, series: [], service_stages: [], top_clients: [], top_products: [], recent_activity: [] },
            searchTerm: "",
            searching: false,
            searchResults: [],
            searchOpen: false,
        });
        this.navItems = [
            { key: "home", label: "Início", icon: "fa-home" },
            { key: "sales", label: "Vendas", icon: "fa-shopping-cart" },
            { key: "purchase", label: "Compras", icon: "fa-shopping-basket" },
            { key: "stock", label: "Estoque", icon: "fa-cubes" },
            { key: "service", label: "Ordens de Serviço", icon: "fa-wrench" },
            { key: "contracts", label: "Contratos", icon: "fa-file-text-o" },
            { key: "projects", label: "Projetos", icon: "fa-briefcase" },
            { key: "finance", label: "Financeiro", icon: "fa-money" },
            { key: "accounting", label: "Contabilidade", icon: "fa-calculator" },
            { key: "fiscal", label: "Fiscal (Brasil)", icon: "fa-file-text" },
            { key: "maintenance", label: "Ativos e Manutenção", icon: "fa-cogs" },
            { key: "fleet", label: "Frota", icon: "fa-car" },
            { key: "hr", label: "Recursos Humanos", icon: "fa-users" },
            { key: "timesheets", label: "Timesheets", icon: "fa-clock-o" },
        ];
        onWillStart(() => this.loadDashboard());
    }

    async loadDashboard() {
        this.state.loading = true;
        this.state.error = null;
        try {
            this.state.data = await this.orm.call("cisne.dashboard", "get_dashboard_data", []);
        } catch (error) {
            this.state.error = "Não foi possível carregar os indicadores do dashboard.";
            this.notification.add(this.state.error, { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    async refresh() {
        await this.loadDashboard();
        this.notification.add("Dashboard atualizado.", { type: "success" });
    }

    openSection(key) {
        if (key === "home") return;
        const descriptor = SECTION_ACTIONS[key];
        if (!descriptor) return;
        return this.action.doAction({
            type: "ir.actions.act_window",
            target: "current",
            domain: descriptor.domain || [],
            context: descriptor.context || {},
            ...descriptor,
        });
    }

    openRecord(item) {
        if (!item?.model || !item?.id) return;
        return this.action.doAction({
            type: "ir.actions.act_window",
            name: item.title || "Registro",
            res_model: item.model,
            res_id: item.id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    createRecord(model, name, context = {}) {
        return this.action.doAction({
            type: "ir.actions.act_window",
            name,
            res_model: model,
            views: [[false, "form"]],
            target: "current",
            context,
        });
    }

    async onSearchInput(event) {
        const term = event.target.value || "";
        this.state.searchTerm = term;
        if (term.trim().length < 2) {
            this.state.searchResults = [];
            this.state.searchOpen = false;
            return;
        }
        await this.runSearch();
    }

    async onSearchKeydown(event) {
        if (event.key === "Escape") {
            this.clearSearch();
            return;
        }
        if (event.key === "Enter" && this.state.searchTerm.trim().length >= 2) {
            event.preventDefault();
            await this.runSearch();
        }
    }

    async runSearch() {
        const term = this.state.searchTerm.trim();
        if (term.length < 2) return;
        this.state.searching = true;
        try {
            this.state.searchResults = await this.orm.call("cisne.dashboard", "global_search", [term]);
            this.state.searchOpen = true;
        } catch (error) {
            this.notification.add("A pesquisa não pôde ser concluída.", { type: "warning" });
        } finally {
            this.state.searching = false;
        }
    }

    clearSearch() {
        this.state.searchTerm = "";
        this.state.searchResults = [];
        this.state.searchOpen = false;
    }

    formatMoney(value) {
        if (value === null || value === undefined) return "—";
        const currency = this.state.data.currency || "BRL";
        try {
            return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
        } catch {
            return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
        }
    }

    formatNumber(value) {
        return new Intl.NumberFormat("pt-BR").format(value || 0);
    }

    formatDelta(value) {
        if (value === null || value === undefined) return "sem base comparável";
        const sign = value > 0 ? "+" : "";
        return sign + new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + "% vs. mês anterior";
    }

    deltaClass(value, inverse = false) {
        if (value === null || value === undefined || value === 0) return "cisne-kpi__delta--neutral";
        const favorable = inverse ? !(value > 0) : value > 0;
        return favorable ? "cisne-kpi__delta--positive" : "cisne-kpi__delta--negative";
    }

    get chartMax() {
        const values = (this.state.data.series || []).flatMap((item) => [Number(item.billed || 0), Number(item.purchased || 0)]);
        return Math.max(...values, 1);
    }

    chartHeight(value) {
        const percent = (Number(value || 0) / this.chartMax) * 100;
        return "height: " + Math.max(3, percent) + "%";
    }

    barWidth(value, items) {
        const max = Math.max(...(items || []).map((item) => Number(item.value || 0)), 1);
        const percent = (Number(value || 0) / max) * 100;
        return "width: " + Math.max(2, percent) + "%";
    }

    get serviceTotal() {
        return (this.state.data.service_stages || []).reduce((total, item) => total + Number(item.count || 0), 0);
    }

    get stageDonutStyle() {
        const stages = this.state.data.service_stages || [];
        const total = this.serviceTotal;
        if (!total) return "background: conic-gradient(#e8edf5 0 100%)";
        const colors = ["#1479f8", "#6f43ea", "#19b98b", "#f59e0b", "#ef4444", "#5b7cfa"];
        let cursor = 0;
        const parts = stages.map((stage, index) => {
            const start = cursor;
            cursor += (Number(stage.count || 0) / total) * 100;
            return colors[index % colors.length] + " " + start + "% " + cursor + "%";
        });
        return "background: conic-gradient(" + parts.join(",") + ")";
    }

    stageColor(index) {
        const colors = ["#1479f8", "#6f43ea", "#19b98b", "#f59e0b", "#ef4444", "#5b7cfa"];
        return "background-color: " + colors[index % colors.length];
    }

    activityIcon(kind) {
        return { sale: "fa-shopping-cart", purchase: "fa-shopping-basket", service: "fa-wrench", invoice: "fa-file-text-o" }[kind] || "fa-circle-o";
    }

    activityClass(kind) {
        return "cisne-activity__icon cisne-activity__icon--" + (kind || "default");
    }

    formatActivityDate(value) {
        if (!value) return "";
        const parsed = new Date(value.replace(" ", "T") + "Z");
        if (Number.isNaN(parsed.getTime())) return value;
        return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(parsed);
    }

    get todayLabel() {
        const value = this.state.data.today;
        if (!value) return "";
        const parsed = new Date(value + "T12:00:00");
        return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(parsed);
    }
}

registry.category("actions").add("cisne_branding.dashboard", CisneDashboard);
