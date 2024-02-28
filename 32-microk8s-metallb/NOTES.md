
# Canonical MicroK8S with MetalLB and multiple nodes on Windows Multipass

## Prerequisites

* Windows machine with Multipass installed (https://multipass.run/)

## Setup cluster

```shell
# create instances
multipass launch -n node1 -m 4G -d 10G -c 4
multipass launch -n node2 -m 2G -d 10G -c 4

# install microk8s
multipass exec node1 -- sudo snap install microk8s --classic
multipass exec node2 -- sudo snap install microk8s --classic

# join nodes
multipass exec node1 -- sudo microk8s.add-node --format short
# !!! copy the join command and run it on node2 !!! USE YOUR REAL TOKEN AND IP from node1 command output
multipass exec node2 -- sudo microk8s join 172.28.173.104:25000/2df21aed0c99fff6345fda4a76f314e5/bda5f6103ac3 --worker

# check nodes
multipass exec node1 -- sudo microk8s.kubectl get no

# check suitable address range for MetalLB VIPs from Ubuntu VMs range
multipass ls

# enable addons
multipass exec node1 -- sudo microk8s.enable metallb
```

### publish application

```shell
# deploy nginx
multipass exec node1 -- sudo microk8s.kubectl create deployment web --image=nginx --replicas 6
# expose nginx
multipass exec node1 -- sudo microk8s.kubectl expose deployment web --port=80 --type=LoadBalancer
# check services
multipass exec node1 -- sudo microk8s.kubectl get svc web

# NAME   TYPE           CLUSTER-IP      EXTERNAL-IP    PORT(S)        AGE
# web    LoadBalancer   10.152.183.56   172.28.170.7   80:30187/TCP   2s
# 
# so we can reach nginx externally on 172.28.170.7
#

# LB IP
multipass exec node1 -- sudo microk8s.kubectl get svc web -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
curl 172.28.163.160

# identify pod serving the request
multipass shell node1
# CONTINUE ON NODE1
PODS=$(sudo microk8s.kubectl get po -o name -l app=web)
for POD in $PODS; do echo $POD; sudo microk8s.kubectl exec $POD -- find /usr -name index.html; done
for POD in $PODS; do echo $POD; sudo microk8s.kubectl exec $POD -- sh -c "echo $POD > /usr/share/nginx/html/index.html"; done
# check who is responding on LB
LBIP=$(sudo microk8s.kubectl get svc web -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
for i in $(seq 90); do curl -s $LBIP; done | sort | uniq -c
# leave VM
exit
```

### certificates

```shell
# enable dns, ingress and cert-manager
multipass exec node1 -- sudo microk8s.enable dns cert-manager ingress

# continue ON NODE1
multipass shell node1


# NODE1: store cf token - replace XXX !!! - notice NS cert-manager for Cluste Issuer
CFAPIKEY=xxxx
sudo microk8s kubectl create secret generic cloudflare-api-token-secret --from-literal=api-token=$CFAPIKEY -n cert-manager


# NODE1: create issuer
sudo microk8s kubectl apply -f - <<EOF
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
 name: lets-encrypt
spec:
 acme:
   email: mkoldov@outlook.cz
   server: https://acme-v02.api.letsencrypt.org/directory
   privateKeySecretRef:
     # Secret resource that will be used to store the account's private key.
     name: lets-encrypt-priviate-key
   solvers:
      - dns01:
          cloudflare:
            email: mkoldov@gmail.com
            apiTokenSecretRef:
              name: cloudflare-api-token-secret
              key: api-token
EOF

# NODE1 
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: testme.klaud.online
  namespace: default
spec:
  commonName: testme2.klaud.online
  dnsNames:
  - testme2.klaud.online
  secretName: testme.klaud.online
  privateKey:
    algorithm: ECDSA
    size: 256
  issuerRef:
    name: lets-encrypt
    kind: ClusterIssuer
    group: cert-manager.io
EOF

kubectl logs -f deployment.apps/cert-manager -n cert-manager

kubectl get secret
kubectl get certificate -o yaml

kubectl delete certificate testme.klaud.online

# NODE1: check issuer
sudo microk8s kubectl get clusterissuer -o wide
sudo microk8s kubectl describe clusterissuer

# NODE1: yet another service - will publish it on HTTPS using ingress
sudo microk8s kubectl create deploy --image cdkbot/microbot:1 --replicas 3 microbot
sudo microk8s kubectl expose deploy microbot --port 80 --type ClusterIP
sudo microk8s kubectl get pod,svc


# NODE1: ingress to microbot at HTTPS://microbot.klaud.online
sudo microk8s kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
 name: microbot-ingress
 annotations:
   cert-manager.io/cluster-issuer: lets-encrypt
spec:
 tls:
 - hosts:
   - microbot.klaud.online
   secretName: microbot-ingress-tls
 rules:
 - host: microbot.klaud.online
   http:
     paths:
     - backend:
         service:
           name: microbot
           port:
             number: 80
       path: /
       pathType: Exact
EOF

# NODE1: look at the ingress
sudo microk8s kubectl describe ingress microbot-ingress

# NODE1:
sudo microk8s kubectl get svc -A
sudo microk8s kubectl describe ingress
sudo microk8s kubectl get all -n ingress
sudo microk8s kubectl get certificate
sudo microk8s kubectl describe certificate
sudo microk8s kubectl get secret -o wide
sudo microk8s kubectl describe secret

sudo microk8s kubectl get certificaterequests -A
sudo microk8s kubectl describe certificaterequests -A

# NODE1: check cert-manager logs as it works on our certificate
sudo microk8s.kubectl logs -f deployment.apps/cert-manager -n cert-manager

# NODE1: access app via ingress on 127.0.0.1
curl 127.0.0.1 -H 'Host: microbot.klaud.online' -L -vvv
curl microbot.klaud.online --resolve  microbot.klaud.online:80:127.0.0.1  --resolve  microbot.klaud.online:443:127.0.0.1  -L -vvv

# NODE1: check cert subject
curl microbot.klaud.online --resolve  microbot.klaud.online:80:127.0.0.1  --resolve  microbot.klaud.online:443:127.0.0.1  -L -vvv 2>&1 | grep subject

curl -k -vvv https://127.0.0.1 -H 'Host: microbot.klaud.online'
curl -k -vvv https://127.0.0.1 -H 'Host: microbot.klaud.online/' 2>&1 | grep CN

sudo microk8s kubectl get ingress
sudo microk8s kubectl delete ingress microbot-ingress
sudo microk8s kubectl delete svc microbot
sudo microk8s kubectl delete deploy microbot



# leave node1
exit

```

## Cleanup

```shell
# check existing instances
multipass ls
# delete instances
multipass delete -p node1 #cluster1
multipass delete -p node2 #cluster2

```