
### Install *kind* command

https://kind.sigs.k8s.io/docs/user/quick-start/#installing-from-release-binaries
```shell
# For AMD64 / x86_64
[ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

### Create new cluster using *kind*

https://kind.sigs.k8s.io/docs/user/quick-start/#creating-a-cluster

```shell
# create
kind create cluster --wait 5m

# check
kind get clusters

# check more
kubectl cluster-info --context kind-kind

# nodes
kubectl get nodes
```


### Run your web server

```shell
# start deployment with 3 pods
kubectl create deploy web --image nginx --replicas 3
# IPs
kubectl get pods -o wide --show-labels

# make it accessible on node port
kubectl expose deploy/web --port 80 --type NodePort

# IP of node
kubectl get nodes -o wide
# ports for service
kubectl get svc

# collect the data above
kubectl get nodes -o json | jq '. | keys'
kubectl get nodes -o json | jq '.items[0] | keys'
kubectl get nodes -o json | jq '.items[0].spec | keys'
kubectl get nodes -o json | jq '.items[0].status | keys'
kubectl get nodes -o json | jq '.items[0].status.addresses'
kubectl get nodes -o json | jq -r '.items[0].status.addresses[] | select(.type=="InternalIP") | .address'
WEBIP=$(kubectl get nodes -o json | jq -r '.items[0].status.addresses[] | select(.type=="InternalIP") | .address'); echo $WEBIP

# port via svc/web
kubectl get svc/web -o json | jq -r '.|keys'
kubectl get svc/web -o json | jq -r '.spec.ports[0]|keys'
kubectl get svc/web -o json | jq -r '.spec.ports[0].nodePort'
WEBPORT=$(kubectl get svc/web -o json | jq -r '.spec.ports[0].nodePort'); echo $WEBPORT

echo "Visiting http://$WEBIP:$WEBPORT"
curl -s "http://$WEBIP:$WEBPORT"
```

### Service load-balanding to Pods
```shell
# our servers
kubectl get po -l app=web  -o name
# make them tell you the name
kubectl get po -l app=web  -o name | while read P; do kubectl exec $P -- sh -c "echo $P | tee /usr/share/nginx/html/index.html"; done

# try one 
curl -s "http://$WEBIP:$WEBPORT"

# try in scale
for N in {1..50}; do curl -s "http://$WEBIP:$WEBPORT"; done
# count Pods visited
for N in {1..50}; do curl -s "http://$WEBIP:$WEBPORT"; done | sort | uniq -c | sort -nr
```

https://kind.sigs.k8s.io/docs/user/loadbalancer/


k get po -l app=web  -o name | while read P; do kubectl exec $P -- sh -c "echo $P | tee /usr/share/nginx/html/index.html"; done
 for P in {1..50}; do curl -s 172.18.255.200/; done | sort | uniq -c
 