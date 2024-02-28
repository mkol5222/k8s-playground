
# Canonical MicroK8S with MetalLB and multiple nodes on Windows Multipass

## Prerequisites

* Windows machine with Multipass installed (https://multipass.run/)

## Setup cluster

```shell
# create instances
multipass launch -n node1 -m 2G -d 10G -c 4
multipass launch -n node2 -m 2G -d 10G -c 4

# install microk8s
multipass exec node1 -- sudo snap install microk8s --classic
multipass exec node2 -- sudo snap install microk8s --classic

# join nodes
multipass exec node1 -- sudo microk8s.add-node
# !!! copy the join command and run it on node2 !!! USE YOUR REAL TOKEN AND IP from node1 command output
multipass exec node2 -- sudo microk8s join 172.28.171.86:25000/084fd69c8662d44bf637499b5d4dad9d/814b85a67cfe --worker

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
sudo microk8s.kubectl get svc web -o jsonpath='{.status.loadBalancer.ingress[0].ip}'; echo
curl 172.28.170.7

# identify pod serving the request
multipass shell node1
# CONTINUE ON NODE1
PODS=$(sudo microk8s.kubectl get po -o name -l app=web)
for POD in $PODS; do echo $POD; sudo microk8s.kubectl exec $POD -- find /usr -name index.html; done
for POD in $PODS; do echo $POD; sudo microk8s.kubectl exec $POD -- sh -c "echo $POD > /usr/share/nginx/html/index.html"; done
# check who is responding on LB
LBIP=$(sudo microk8s.kubectl get svc web -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
for i in $(seq 90); do curl -s $LBIP; done | sort | uniq -c
```

## Cleanup

```shell
# check existing instances
multipass ls
# delete instances
multipass delete -p node1 #cluster1
multipass delete -p node2 #cluster2

```