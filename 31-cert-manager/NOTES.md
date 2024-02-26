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


# uninstall
kubectl get Issuers,ClusterIssuers,Certificates,CertificateRequests,Orders,Challenges --all-namespaces
helm --namespace cert-manager delete cert-manager
kubectl delete namespace cert-manager
kubectl delete -f https://github.com/cert-manager/cert-manager/releases/download/vX.Y.Z/cert-manager.crds.yaml

```