FROM odoo:18.0-20260908

USER root

ARG L10N_BRAZIL_SHA=9c1267e8b88d53348d6871b60d06fddc160c23d1
ARG FIELD_SERVICE_SHA=0c9d1695986a4317aea01151457544e536223954
ARG CONTRACT_SHA=177b69f09e418fb5c0d3edfada98f7eaae45bc42
ARG PRODUCT_ATTRIBUTE_SHA=b134a4f8a37464374096b49f118c2c209b44b132
ARG BANK_PAYMENT_SHA=774755ac57f6cfed3db3fedbfeba76a151bb7cbe

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        git \
        libffi-dev \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    mkdir -p /opt/oca /mnt/extra-addons; \
    fetch_repo() { \
      repo="$1"; dest="$2"; sha="$3"; \
      git init "$dest"; \
      git -C "$dest" remote add origin "$repo"; \
      git -C "$dest" fetch --depth 1 origin "$sha"; \
      git -C "$dest" checkout --detach FETCH_HEAD; \
    }; \
    fetch_repo https://github.com/OCA/l10n-brazil.git /opt/oca/l10n-brazil "$L10N_BRAZIL_SHA"; \
    fetch_repo https://github.com/OCA/field-service.git /opt/oca/field-service "$FIELD_SERVICE_SHA"; \
    fetch_repo https://github.com/OCA/contract.git /opt/oca/contract "$CONTRACT_SHA"; \
    fetch_repo https://github.com/OCA/product-attribute.git /opt/oca/product-attribute "$PRODUCT_ATTRIBUTE_SHA"; \
    fetch_repo https://github.com/OCA/bank-payment.git /opt/oca/bank-payment "$BANK_PAYMENT_SHA"

RUN pip3 install --break-system-packages --no-cache-dir \
      -r /opt/oca/l10n-brazil/requirements.txt \
      -r /opt/oca/contract/requirements.txt

COPY config/odoo.conf /etc/odoo/odoo.conf
COPY addons/cisne_branding /mnt/extra-addons/cisne_branding
COPY scripts/bootstrap.sh /opt/cisne/bootstrap.sh

RUN chmod 0755 /opt/cisne/bootstrap.sh \
    && chown -R odoo:odoo /mnt/extra-addons /opt/oca /opt/cisne /etc/odoo/odoo.conf

USER odoo

ENTRYPOINT ["/opt/cisne/bootstrap.sh"]
