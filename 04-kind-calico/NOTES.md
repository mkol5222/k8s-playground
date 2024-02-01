# Kind with Calico as Pod Network Policy playground

```shell
# our working dir
cd /workspaces/k8s-playground/04-kind-calico

# get arkade - cloud native package manager and tool
# https://github.com/alexellis/arkade?tab=readme-ov-file#getting-arkade
curl -sLS https://get.arkade.dev | sudo sh

# get kind 
ark get kind
sudo mv /home/vscode/.arkade/bin/kind /usr/local/bin/

# create kind cluster based on config with default CNI disabled:
cat ./kind-calico.yaml

# create cluster
kind create cluster --config kind-calico.yaml

# check the cluster
kubectl get no
kubectl get po -A
# yes, some pods are in Pending state because of missing CNI

# install Calico CNI
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/tigera-operator.yaml
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/custom-resources.yaml

# watch progress
kubectl get pods -A --watch

# finally all should get Status Running, right?
kubectl get pods -A

# lets create pod and check it is able to reach Internet
kubectl create deploy web --image nginx --port 80
WEBPOD=$(kubectl get po -l app=web -o name | head -1)
kubectl exec -it $WEBPOD -- curl ip.iol.cz/ip/
# once pod is created, request should return your Codespace public IP

# we can probe Internet continously
while true; do kubectl exec -it $WEBPOD -- curl -s -m1 ip.iol.cz/ip/; sleep 2; done
# open one more terminal in VScode, to keep it running in parallel

# pod is reaching ip.iol.cz, so default policy is allow all egress

# implement deny all egress
cat ./default-deny-all-egress.yaml
kubectl apply -f ./default-deny-all-egress.yaml

# is pod still able to reach Internet?
#   sploiler: curl should report error

# lets allow HTTP/HTTPS and DNS to Internet 
cat allow-http-and-dns-egress.yaml
kubectl apply -f allow-http-and-dns-egress.yaml

# did it resolve connectivity issue from our pod?
#    spoiler: pod should be reaching ip.iol.cz now and telling your public IP

# there are two policies for default namespaces - they are joined with OR !!!
#   so deny all egress fails to match, but allow http and dns is matching ...

# inspect the policy
kubectl get networkpolicy

POLICIES=$(kubectl get networkpolicy -o name)
echo $POLICIES

# describe makes it readable by humans
for P in $POLICIES; do echo $P; kubectl describe $P; done


# once we are done, we can delete the cluster
kind delete cluster
```