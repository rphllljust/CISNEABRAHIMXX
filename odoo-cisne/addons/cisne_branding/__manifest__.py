{
    "name": "Cisne Rondônia Branding",
    "summary": "Identidade e workspace executivo do ERP Cisne Rondônia sobre Odoo Community",
    "version": "18.0.2.0.0",
    "license": "LGPL-3",
    "author": "Cisne Rondônia",
    "depends": [
        "web",
        "sale_management",
        "purchase",
        "stock",
        "account",
        "project",
        "maintenance",
        "fleet",
        "hr_timesheet",
        "contract",
        "fieldservice",
        "l10n_br_fiscal",
    ],
    "data": [
        "views/branding.xml",
        "views/dashboard_views.xml",
    ],
    "assets": {
        "web.assets_frontend": [
            "cisne_branding/static/src/scss/cisne.scss",
        ],
        "web.assets_backend": [
            "cisne_branding/static/src/scss/cisne.scss",
            "cisne_branding/static/src/scss/dashboard.scss",
            "cisne_branding/static/src/js/dashboard.js",
            "cisne_branding/static/src/xml/dashboard.xml",
        ],
    },
    "installable": True,
    "application": True,
}
