FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl git ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir hermes-agent[all]

RUN git clone --depth 1 https://github.com/nesquena/hermes-webui.git /opt/hermes-webui && \
    cd /opt/hermes-webui && \
    pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /root/.hermes/skills /root/.hermes/sessions /root/.hermes/logs /root/.hermes/memories

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8642 8787

ENTRYPOINT ["/entrypoint.sh"]
