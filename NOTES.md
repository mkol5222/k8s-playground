https://kind.sigs.k8s.io/docs/user/quick-start/#installing-from-release-binaries

https://kind.sigs.k8s.io/docs/user/loadbalancer/


k get po -l app=web  -o name | while read P; do kubectl exec $P -- sh -c "echo $P | tee /usr/share/nginx/html/index.html"; done
 for P in {1..50}; do curl -s 172.18.255.200/; done | sort | uniq -c
 