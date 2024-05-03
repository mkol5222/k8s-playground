# Missing CloudGuard WAF command line tool

Goals:
* allow command-line interface automation of CloudGuard WAF polies
* e.g. create web application asset and assign it to WAF profile
* bulk add web applications
* query information like WAF SaaS profile domain validation or protection CNAMEs


```shell
# install Deno
curl -fsSL https://deno.land/install.sh | sh
export DENO_INSTALL="/home/vscode/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"
# working folder
cd /workspaces/k8s-playground/35-cgwaf-cli
# add CGWAF_ID and CGWAF_KEY into .env
tee .env << EOF
CGWAF_ID=xxx
CGWAF_KEY=yyy
EOF
code .env

# run
./cgwaf.ts -h
```