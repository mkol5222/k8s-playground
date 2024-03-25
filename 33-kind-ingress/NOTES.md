
# Kubernetes Ingress with KIND cluster in Codespace

Reference: https://kind.sigs.k8s.io/docs/user/ingress/

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
```