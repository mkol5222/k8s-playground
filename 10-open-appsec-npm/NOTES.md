https://www.openappsec.io/post/announcing-open-appsec-waf-integration-with-nginx-proxy-manager?s=03

```shell
cd /workspaces/k8s-playground/10-open-appsec-npm
mkdir ./appsec-localconfig

wget https://raw.githubusercontent.com/openappsec/open-appsec-npm/main/deployment/local_policy.yaml -O ./appsec-localconfig/local_policy.yaml

wget https://raw.githubusercontent.com/openappsec/open-appsec-npm/main/deployment/docker-compose.yaml
code docker-compose.yaml
```