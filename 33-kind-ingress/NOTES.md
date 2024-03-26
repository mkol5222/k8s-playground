
# Kubernetes Ingress with KIND cluster in Codespace

Reference: https://kind.sigs.k8s.io/docs/user/ingress/ and https://kind.sigs.k8s.io/docs/user/loadbalancer/

```shell
# working folder
cd /workspaces/k8s-playground/33-kind-ingress

# get arkade - cloud native package manager and tool
# https://github.com/alexellis/arkade?tab=readme-ov-file#getting-arkade
curl -sLS https://get.arkade.dev | sudo sh

# get kind 
ark get kind
sudo mv /home/vscode/.arkade/bin/kind /usr/local/bin/

# get k9s
ark get k9s
sudo mv /home/vscode/.arkade/bin/k9s /usr/local/bin/

cat <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF

alias k=kubectl

# install NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# wait for readiness
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# quick test
k create ns web
k create deploy web --image nginx --replicas 3 -n web

# expose as ClusterIP
k expose deploy/web --port 80 --type ClusterIP -n web
# check
k get svc -n web
k get ingressclass -n ingress

# define ingress
cat << EOF | k apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
 name: web
 namespace: web
 annotations:
   cert-manager.io/cluster-issuer: lets-encrypt
   external-dns.alpha.kubernetes.io/hostname: www-test.cloudguard.rocks.
   external-dns.alpha.kubernetes.io/ttl: "60"
spec:
 ingressClassName: nginx
 tls:
 - hosts:
   - www-test.cloudguard.rocks
   secretName: www-test-ingress-tls
 rules:
 - host: www-test.cloudguard.rocks
   http:
     paths:
     - backend:
         service:
           name: web
           port:
             number: 80
       path: /
       pathType: Prefix
EOF

# check it
k describe ing -n web

# cli test
k get svc -n ingress-nginx

# check HTTP (redirect)
curl www-test.cloudguard.rocks --resolve www-test.cloudguard.rocks:80:127.0.0.1 -L -vvv

# check contents
curl https://www-test.cloudguard.rocks --resolve www-test.cloudguard.rocks:443:127.0.0.1 -L -vvv -k 

# check cert
curl https://www-test.cloudguard.rocks --resolve www-test.cloudguard.rocks:443:127.0.0.1 -L -vvv -k 2>&1 | grep CN

# port forwarding to localhost via VScode works...


# MetalLB with Kind in Docker
#   https://kind.sigs.k8s.io/docs/user/loadbalancer/

# deploy
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.7/config/manifests/metallb-native.yaml

# check cidr for kind
docker network inspect -f '{{.IPAM.Config}}' kind
# eg. 172.18.0.0/16

# modify cidr below!!!
cat << EOF | k apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: example
  namespace: metallb-system
spec:
  addresses:
  - 172.18.0.200-172.18.0.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: empty
  namespace: metallb-system
EOF

# is running
k get all -n metallb-system

# try expose some service
k create deploy web2 --image nginx
k expose deploy/web2 --port 80 --type LoadBalancer
k get svc web2

# how it worked?
k scale deploy/controller --replicas 0 -n metallb-system
k scale deploy/controller --replicas 1 -n metallb-system
k -n metallb-system logs -f deploy/controller

# does it have EXTERNAL-IP?
k get svc web2 
# NAME   TYPE           CLUSTER-IP      EXTERNAL-IP    PORT(S)        AGE
# web2   LoadBalancer   10.96.187.197   172.18.0.200   80:30532/TCP   6m47s

# local access to LB IP
echo http://$(k get svc web2 -o json | jq -r .status.loadBalancer.ingress[0].ip)
curl http://$(k get svc web2 -o json | jq -r .status.loadBalancer.ingress[0].ip)

# now we need to forward this 172.18.0.200 services to our browser, if needed


### Lets Encrypt Certificates with CloudFlare DNS-01

# External DNS to automate A records to Ingress or Svc IPs

# create namespace for external-dns
k create ns external-dns

# use real Cloudflare API token and e-mail - ask instructor
export EMAIL=someone@example.com
export CFTOKEN='bring-your-own-token'

# store as secret
kubectl -n external-dns create secret generic  cf-dns-setup --from-literal=CF_API_EMAIL=$EMAIL --from-literal=CF_API_TOKEN=$CFTOKEN
# check
k describe -n external-dns secret/cf-dns-setup

# deploy it to NS external-dns for domain cloudguard.rocks

cat << 'EOF' | k apply -n external-dns -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-dns
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: external-dns
rules:
- apiGroups: [""]
  resources: ["services","endpoints","pods"]
  verbs: ["get","watch","list"]
- apiGroups: ["extensions","networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get","watch","list"]
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: external-dns-viewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: external-dns
subjects:
- kind: ServiceAccount
  name: external-dns
  namespace: default
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: external-dns
spec:
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: external-dns
  template:
    metadata:
      labels:
        app: external-dns
    spec:
      serviceAccountName: external-dns
      containers:
      - name: external-dns
        image: registry.k8s.io/external-dns/external-dns:v0.14.0
        args:
        - --source=service 
        - --source=ingress 
        - --domain-filter=cloudguard.rocks 
        - --provider=cloudflare
        - --txt-owner-id=mko.cloudguard-rocks # use your own!
        env:
        - name: CF_API_TOKEN
          valueFrom:
             secretKeyRef:
                name: cf-dns-setup
                key: CF_API_TOKEN
        - name: CF_API_EMAIL
          valueFrom:
             secretKeyRef:
                name: cf-dns-setup
                key: CF_API_EMAIL
---
EOF

# check what was deployed for you
k get all -n external-dns

# logs
k -n external-dns logs -f deploy/external-dns

# note: ingress above has
# www-test.cloudguard.rocks. in external-dns annotation

### OPEN ISSUE: external-dns cannot talk to k8s API
# time="2024-03-25T20:46:01Z" level=info msg="Using inCluster-config based on serviceaccount-token"
# time="2024-03-25T20:46:01Z" level=info msg="Created Kubernetes client https://10.96.0.1:443"
# time="2024-03-25T20:47:01Z" level=fatal msg="failed to sync *v1.Pod: context deadline exceeded"
# NAME         TYPE           CLUSTER-IP      EXTERNAL-IP    PORT(S)        AGE
# kubernetes   ClusterIP      10.96.0.1       <none>         443/TCP        36m

### Certificate Manager for Lets Encrypt Certificates

#  ark install --help | grep cert-manager
#  cert-manager                    Install cert-manager

ark install cert-manager

k get all -n cert-manager

# cluster issuer for Lets Encrypt

# use real Cloudflare API token and e-mail - ask instructor
export EMAIL=someone@example.com
export CFTOKEN='bring-your-own-token'

# store as secret
k -n cert-manager create secret generic  cloudflare-api-token-secret --from-literal=api-token=$CFTOKEN
# check
k -n cert-manager describe secret/cloudflare-api-token-secret
echo $EMAIL

# make cluster issuer for lets-encrypt with DNS-01 challenge
cat << 'EOF' | sed "s/someone@example.com/$EMAIL/" | k apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
 name: lets-encrypt
 namespace: cert-manager
spec:
 acme:
   email: someone@example.com
   server: https://acme-v02.api.letsencrypt.org/directory
   privateKeySecretRef:
     # Secret resource that will be used to store the account's private key.
     name: lets-encrypt-priviate-key
   # Add a single challenge solver, DNS01 using cloudflare
   solvers:
    - dns01:
        cloudflare:
          email: someone@example.com
          apiTokenSecretRef:
            name: cloudflare-api-token-secret
            key: api-token
EOF

# check logs
k -n cert-manager logs -f deploy/cert-manager

# check certificates
k get certificate -A
# wait for READY state
k get certificate -A --watch

#NAMESPACE   NAME                   READY   SECRET                 AGE
# web         www-test-ingress-tls   False   www-test-ingress-tls   2m33s
# web         www-test-ingress-tls   True    www-test-ingress-tls   2m41s



### to do NGINX Ingress default certificate
curl -s https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml | less
# look under args: for /nginx-ingress-controller

# own self signed certificate
# self signed cert
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout tls.key -out tls.crt -subj "/CN=example.com"
# make k8s secret from it
kubectl create secret tls example-com-tls --key tls.key --cert tls.crt
# see  secret default/example-com-tls 
k get secret -n default example-com-tls -o yaml

curl -s https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml | grep -C 5 '/nginx-ingress-controller'
# add one more arg
curl -s https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml | curl -s https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml | sed '/nginx-ingress-controller/a \ \ \ \ \ \ \ \ - --default-ssl-certificate=default/example-com-tls' | grep -C 5 '/nginx-ingress-controller'
# apply change
curl -s https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml | curl -s https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml | sed '/nginx-ingress-controller/a \ \ \ \ \ \ \ \ - --default-ssl-certificate=default/example-com-tls'  | kubectl apply -f -

# check it for real
k describe ing -A
k get svc -n ingress-nginx # mapped by KIND to localhost

curl https://127.0.0.1 -k -vvv 2>&1 | grep CN
curl https://www-test.cloudguard.rocks --resolve www-test.cloudguard.rocks:443:127.0.0.1 -vvv 2>&1 | grep CN

### REPLACE WITH APPSEC

# uninstall
curl -s https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml | k delete -f -

# fetch appsec helm chart
wget https://downloads.openappsec.io/packages/helm-charts/nginx-ingress/open-appsec-k8s-nginx-ingress-latest.tgz

# obtain AppSec Kubernetes Profile token from Infinity Portal
export CPTOKEN=cp-1111 # use your own!


```