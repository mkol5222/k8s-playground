https://kind.sigs.k8s.io/docs/user/quick-start/#installing-from-release-binaries

https://kind.sigs.k8s.io/docs/user/loadbalancer/


k get po -l app=web  -o name | while read P; do kubectl exec $P -- sh -c "echo $P | tee /usr/share/nginx/html/index.html"; done
