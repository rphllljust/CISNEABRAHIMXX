{
    "name": "Cisne Rondônia Branding",
    "summary": "Marca própria do ERP Cisne Rondônia sobre Odoo Community",
    "version": "18.0.1.0.0",
    "license": "LGPL-3",
    "author": "Cisne Rondônia",
    "depends": ["web"],
    "data": [
        "views/branding.xml",
    ],
    "assets": {
        "web.assets_frontend": [
            "cisne_branding/static/src/scss/cisne.scss",
        ],
        "web.assets_backend": [
            "cisne_branding/static/src/scss/cisne.scss",
        ],
    },
    "installable": True,
    "application": False,
}
