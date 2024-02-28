# CloudGuard WAF aka AppSec deployment to K8S

```shell

# continue ON NODE1
multipass shell node1

# new AppSec Web App profile
#  https://portal.checkpoint.com/dashboard/appsec#/waf-policy/profiles/
#  Docker profile
#  Single Container
#  NGINX is MANAGED by Check Point
#  Publish and ENFORCE
#  copy token cp-67c24b73-e******

# NODE1:
T=cp-67c24b73-eae4-445b-a7XXXXXXXX
sudo microk8s.kubectl create secret generic appsec --from-literal=cptoken=$T

cat > appsec.yml
# paste and CTRL-D

sudo microk8s.kubectl apply -f appsec.yml
sudo microk8s.kubectl get po --watch # ctrl-c once both running

sudo microk8s.kubectl describe svc appsec
# assigned IP e.g. 172.28.163.161

curl 172.28.163.161
# test site
curl http://microk8s --resolve microk8s:80:172.28.163.161
# incident
curl http://microk8s/?q=cat+/etc/passwd --resolve microk8s:80:172.28.163.161

sudo microk8s.kubectl exec -it deploy/appsec -- cpnano -s
sudo microk8s.kubectl exec -it deploy/appsec -- sh
 nginx -T | grep proxy_pass
 cpnano -s
 tail -f tail -f /var/log/nano_agent/cp-nano-orchestration.dbg
 cat /etc/cp/conf/settings.json | jq .

# certificate using ingress

# NODE1:
sudo microk8s kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
 name: microk8s-ingress
 annotations:
   cert-manager.io/cluster-issuer: lets-encrypt
spec:
 tls:
 - hosts:
   - microk8s.klaud.online
   secretName: microk8s-ingress-tls
 rules:
 - host: microk8s.klaud.online
   http:
     paths:
     - backend:
         service:
           name: appsec
           port:
             number: 80
       path: /
       pathType: Exact
EOF

sudo microk8s.kubectl logs -f deployment.apps/cert-manager -n cert-manager

# NODE1: check cert subject
curl microk8s.klaud.online --resolve  microk8s.klaud.online:80:127.0.0.1  --resolve  microk8s.klaud.online:443:127.0.0.1  -L -vvv 2>&1 | grep subject

curl microk8s.klaud.online --resolve  microk8s.klaud.online:80:127.0.0.1  --resolve  microk8s.klaud.online:443:127.0.0.1  -L -vvv
curl https://microk8s.klaud.online/?q=aaa --resolve  microk8s.klaud.online:80:127.0.0.1  --resolve  microk8s.klaud.online:443:127.0.0.1 
curl https://microk8s.klaud.online/?q=cat+/etc/passwd --resolve  microk8s.klaud.online:80:127.0.0.1  --resolve  microk8s.klaud.online:443:127.0.0.1 
curl http://microk8s.klaud.online/?q=aaa --resolve  microk8s.klaud.online:80:127.0.0.1  --resolve  microk8s.klaud.online:443:127.0.0.1 

curl https://microk8s.klaud.online/ip/ --resolve  microk8s.klaud.online:80:127.0.0.1  --resolve  microk8s.klaud.online:443:127.0.0.1  -L -vvv


### ingress service
sudo microk8s kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: ingress
  namespace: ingress
spec:
  selector:
    name: nginx-ingress-microk8s
  type: LoadBalancer
  # loadBalancerIP is optional. MetalLB will automatically allocate an IP from its pool if not
  # specified. You can also specify one manually.
  # loadBalancerIP: x.y.z.a
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
    - name: https
      protocol: TCP
      port: 443
      targetPort: 443
EOF
```