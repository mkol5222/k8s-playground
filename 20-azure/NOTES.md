
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
# list all vHubs
az network vhub list -o table
# NVAs in vHUBs?
az network vhub list -o json | jq 
az network vhub show -g poc-vwan -n weHub -o json | jq
az network virtual-appliance list --help
az network virtual-appliance list -o json | jq
# show NVA SKU
az network virtual-appliance list -o json | jq '.[].nvaSku'

# managed apps
az managedapp list -o table
az managedapp list -o json | jq | less
# managed app id
az managedapp list -o json | jq '.[].id'
# image version
az managedapp list -o json | jq '.[].parameters.imageVersion.value'
# managed RG
az managedapp list -o json | jq '.[].managedResourceGroupId'

# update permissions command
# az rest --method POST --uri "/subscriptions/<SUBSCIRPTION ID>/resourceGroups/<RG_NAME>/providers/Microsoft.Solutions/applications/<MANAGED APP>/refreshPermissions?api-version=2019-07-01&targetVersion=1.0.7"
APP_ID=$(az managedapp list --query "[0].id" -o tsv)
echo "Command to refresh permissions:"
echo 
echo "   az rest --method POST --uri '${APP_ID}/refreshPermissions?api-version=2019-07-01&targetVersion=1.0.7'"


az managedapp list --query "[0].id" -o tsv
az managedapp list --query "[0].managedResourceGroupId" -o tsv
az managedapp list --query "[].managedResourceGroupId" -o tsv

# resources of managed app
az resource list -g mrg-azure-vwan-20240104085745 -o table

# get Microsoft.ManagedIdentity/userAssignedIdentities
az resource list -g mrg-azure-vwan-20240104085745 --resource-type Microsoft.ManagedIdentity/userAssignedIdentities -o json

# if multiple subscriptions
export SUBSCRIPTION_ID=$(az account list --query "[?isDefault].id" -o tsv)
az network virtual-appliance list --subscription $SUBSCRIPTION_ID -o json | jq '.[].nvaSku'
```