
# vWAN

```shell
# this project folder
cd /workspaces/k8s-playground/20-azure
# login to Azure - we assume Codespace opened in desktop VSCode
az login
# confirm
az account list -o table

# query default subscription, output only id
az account list --query "[?isDefault].id" -o tsv
# store
export SUBSCRIPTION_ID=$(az account list --query "[?isDefault].id" -o tsv)

# list all vWANs
# it might want to install virtual-wan cli extension
az config set extension.use_dynamic_install=yes_without_prompt
# list vWANs
az network vwan list -o table


```