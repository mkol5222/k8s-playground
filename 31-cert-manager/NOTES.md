https://cert-manager.io/docs/installation/helm/#crd-considerations

```shell
helm repo add jetstack https://charts.jetstack.io --force-update
helm repo update

# get arkade - cloud native package manager and tool
# https://github.com/alexellis/arkade?tab=readme-ov-file#getting-arkade
curl -sLS https://get.arkade.dev | sudo sh

# get kind 
ark get kind
sudo mv /home/vscode/.arkade/bin/kind /usr/local/bin/

# create cluster
kind create cluster
kubectl get no

# cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.3/cert-manager.crds.yaml
# 
helm install \
  cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.3 \
  # --set installCRDs=true

kubectl get ns
kubectl get all -n cert-manager

# use
cd /workspaces/k8s-playground/31-cert-manager/
kubectl apply -f selfsign-ca.yml

kubectl get Certificate -A
kubectl -n cert-manager get Certificate/my-selfsigned-ca
kubectl -n cert-manager describe Certificate/my-selfsigned-ca

kubectl get secret -A
kubectl -n cert-manager describe secret/root-secret

kubectl -n cert-manager get secret/root-secret -o json | jq -r '.data."ca.crt"' | base64 -d | tee /tmp/ca.crt
openssl x509 -in /tmp/ca.crt -text -noout | grep -i CN

# issue new cert
kubectl apply -f cert.yml
kubectl get Certificate -A
kubectl -n sandbox describe Certificate/first-cert

kubectl get secret -A
kubectl -n sandbox describe secret/first-cert

kubectl -n sandbox get secret/first-cert -o json |  jq -r '.data."ca.crt"' | base64 -d | tee /tmp/ca.crt
openssl x509 -in /tmp/ca.crt -text -noout | grep -i CN

kubectl -n sandbox get secret/first-cert -o json |  jq -r '.data."tls.crt"' | base64 -d | tee /tmp/tls.crt
openssl x509 -in /tmp/tls.crt -text -noout | grep -i CN
openssl x509 -in /tmp/tls.crt -text -noout | grep -i DNS

# Lets Encrypt with DuckDNS
# add DUCKDNS_TOKEN to this repo codespace secrets: https://github.com/settings/codespaces/secrets/new
# add ISSUER_EMAIL to this repo codespace secrets

cd /workspaces/k8s-playground/31-cert-manager/
git clone https://github.com/ebrianne/cert-manager-webhook-duckdns.git

 helm install cert-manager-webhook-duckdns \
     --namespace cert-manager \
     --set duckdns.token=$DUCKDNS_TOKEN \
     --set clusterIssuer.production.create=true \
     --set clusterIssuer.staging.create=true \
     --set clusterIssuer.email=$ISSUER_EMAIL \
     --set logLevel=2 \
     ./cert-manager-webhook-duckdns/deploy/cert-manager-webhook-duckdns
 
 DOMAIN=myklaud.duckdns.org
cat << EOF | sed "s/example-com/$DOMAIN/" | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-com
  namespace: default
spec:
  dnsNames:
  - 'example-com'
  issuerRef:
    name: cert-manager-webhook-duckdns-production
    kind: ClusterIssuer
  secretName: example-com-tls
EOF

kubectl describe certificate.cert-manager.io/$DOMAIN
kubectl get secret $DOMAIN-tls -o yaml
kubectl get secret $DOMAIN-tls -o json |  jq -r '.data."tls.crt"' | base64 -d | tee /tmp/tls.crt
openssl x509 -in /tmp/tls.crt -text -noout | grep -i CN
openssl x509 -in /tmp/tls.crt -text -noout | grep -i DNS
dig $DOMAIN

# IP updates:
curl -L https://duckdns.org/update/$DOMAIN/$DUCKDNS_TOKEN/127.0.0.1
dig duckdns.org ns
dig +short $DOMAIN @ns9.duckdns.org

# deploy nginx
# http
kubectl apply -f nginx-deploy.yml
kubectl get po
kubectl port-forward svc/nginx 8080:80
# open in browser - see vscode PORTS section
# remove NGINX
kubectl delete -f nginx-deploy.yml

# now with TLS
kubectl get -n sandbox secrets # expected first-cert
kubectl apply -n sandbox -f nginx-deploy-tls.yml
kubectl get po -n sandbox
kubectl describe po -n sandbox
kubectl -n sandbox port-forward svc/nginx 8443:443

# cert
NODEIP=$(kubectl get no -o json | jq -r '.items[0].status.addresses[0].address')
curl -k -vvv https://$NODEIP:30009 2>&1 | grep CN

# open in browser - see vscode PORTS section
# remove NGINX
kubectl delete -n sandbox -f nginx-deploy-tls.yml


# uninstall
kubectl get Issuers,ClusterIssuers,Certificates,CertificateRequests,Orders,Challenges --all-namespaces
helm --namespace cert-manager delete cert-manager
kubectl delete namespace cert-manager
kubectl delete -f https://github.com/cert-manager/cert-manager/releases/download/vX.Y.Z/cert-manager.crds.yaml

```