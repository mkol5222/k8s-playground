#!/bin/bash

# API key to API requests auth token
function getToken {
    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/auth/external \
        --header 'content-type: application/json' \
        --data "{\"clientId\":\"$1\" ,\"accessKey\":\"$2\" }")
    TOKEN=$(echo "$RESP" | jq -r '.data.token')
}

# save changes to management db
function publishChanges {
    read -r -d '' QUERY <<'EOF'
        mutation {
        publishChanges {
            isValid
            errors {
                id type subType name message 
            }
            warnings {
            id type subType name message
            }
        }
        }
EOF
    BODY=$(jq -r -n --arg Q "$QUERY" '{query:$Q}')
    

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY")
    RES=$(echo "$RESP" | jq -r '.')
    echo "$RES"
}

# start policy enforcement action task
function enforcePolicy {
    read -r -d '' QUERY <<'EOF'
    mutation {
        enforcePolicy {
            id
        }
    }
EOF
    BODY=$(jq -r -n --arg Q "$QUERY" '{query:$Q}')
    

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY")
    RES=$(echo "$RESP" | jq -r '.')
    # echo "$RES"
    ENFORCETASK=$(echo "$RESP" | jq -r '.data.enforcePolicy.id')
    echo "$ENFORCETASK"
}

# get task status
function getTask {
    read -r -d '' QUERY <<'EOF'
query getTask($id: ID!) {
  getTask(id: $id) {
    id
    tenantId
    type
    status
    message
    startTime
    endTime
    errorCode
    referenceId
  }
}
EOF
    BODY=$(jq -r -n --arg Q "$QUERY" --arg T "$1" '{query:$Q,variables:{id:$T}}')
    

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY")
    RES=$(echo "$RESP" | jq -r '.')
    echo "$RES"
}

# enfoce and make sure it is finished
function enforcePolicyAndWait {
    T=$(enforcePolicy)
    
    while : ; do
        echo -n '.'
        S=$(getTask "$T" | jq -r .data.getTask.status)
        # echo "$S"
        [[ "$S" = "InProgress" ]] || break
        sleep 1
    done
    echo  
}

# get profile auth token for installation / deployment
function getProfileToken {
    read -r -d '' QUERY <<'EOF'
query getProfile($id:ID!) {
	getEmbeddedProfile(id:$id) {
    name
    status
    authentication {
      authenticationType
      maxNumberOfAgents
      token
    }
  }
}
EOF
    BODY=$(jq -r -n --arg Q "$QUERY" --arg I "$1" '{query:$Q,variables:{id:$I}}')
    

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY")

    ERRORS=$(echo "$RESP" | jq -r '.errors')
    # echo "$ERRORS"
    if [ "$ERRORS" = "null" ]; then
        true
        #echo "Success creating new web app asset"
    else
        echo "Error in getProfileToken"
        ERR=$(echo "$RESP" | jq -r '.errors[0].message')
        echo "   ${ERR}. Exiting..."
        exit 1
    fi

    RES=$(echo "$RESP" | jq -r '.')
    # echo "$RES"
    PROFILETOKEN=$(echo "$RESP" | jq -r '.data.getEmbeddedProfile.authentication.token')
    echo "$PROFILETOKEN"
}

function getBestPractice {
    read -r -d '' Q_BESTPRACTICE <<'EOF'
query {
	getPractices(includePrivatePractices: false, matchSearch:"WEB APPLICATION BEST PRACTICE") {
    id name
  }
}
EOF
    BODY_BESTPRACTICE=$(jq -r -n --arg Q "$Q_BESTPRACTICE" '{query:$Q}')
    

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY_BESTPRACTICE")

    ERRORS=$(echo "$RESP" | jq -r '.errors')
    # echo "$ERRORS"
    if [ "$ERRORS" = "null" ]; then
        true
        #echo "Success creating new web app asset"
    else
        echo "Error in getBestPractice"
        ERR=$(echo "$RESP" | jq -r '.errors[0].message')
        echo "   ${ERR}. Exiting..."
        exit 1
    fi

    PRACTICEID=$(echo "$RESP" | jq -r '.data.getPractices[0].id')
    echo "$PRACTICEID"
}

function getLinuxAgents {
    read -r -d '' Q_LINUXPROFILE <<'EOF'
        query  {
            getProfiles(matchSearch:"Linux Agents") {
                id name
            }
        }
EOF
    BODY_LINUXPROFILE=$(jq -r -n --arg Q "$Q_LINUXPROFILE" '{query:$Q}')
    

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY_LINUXPROFILE")
        #echo $RESP

    ERRORS=$(echo "$RESP" | jq -r '.errors')
    # echo "$ERRORS"
    if [ "$ERRORS" = "null" ]; then
        true
        #echo "Success creating new web app asset"
    else
        echo "Error in getLinuxAgents"
        ERR=$(echo "$RESP" | jq -r '.errors[0].message')
        echo "   ${ERR}. Exiting..."
        exit 1
    fi

    LINUXPROFILEID=$(echo "$RESP" | jq -r '.data.getProfiles[0].id')
    echo "$LINUXPROFILEID"
}

function newLinuxProfile {
    read -r -d '' M_NEWPROFILE <<'EOF'
mutation {
  newEmbeddedProfile(profileInput:{}) {
    id name
  }
}
EOF
    BODY_NEWPROFILE=$(jq -r -n --arg Q "$M_NEWPROFILE" '{query:$Q}')
    

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY_NEWPROFILE")
    NEWPROFILEID=$(echo "$RESP" | jq -r '.data.newEmbeddedProfile.id')
    echo "$NEWPROFILEID"
}


function newWebAsset {
    read -r -d '' Q_NEWWEBASSET <<'EOF'
mutation newWebAppAsset($assetInput:WebApplicationAssetInput!)  {
	newWebApplicationAsset(assetInput:$assetInput) {
    id name
  }
}
EOF
    read -r -d '' JQ_SCRIPT <<'EOF'
{ 
    query:$Q, 
    variables: {
        assetInput: {
            name: $N,
   	        URLs: [$U],
            "profiles": [$P],
            "practices": {
                "mainMode": "Prevent",
                "practiceId": $B
            }
       }
    } 
}
EOF

# echo "$JQ_SCRIPT"

    URLHASH=$(echo "$1" | md5sum | cut -d' ' -f1)
    NAME="WebAsset-$URLHASH"
    BODY_NEWWEBASSET=$(jq -r -n --arg Q "$Q_NEWWEBASSET" \
        --arg U "$1" --arg N "$NAME" \
        --arg P "$LINUXPROFILEID" --arg B "$PRACTICEID" \
        "$JQ_SCRIPT" )

    # echo "$BODY_NEWWEBASSET"

    RESP=$(curl -s --request POST \
        --url https://cloudinfra-gw.portal.checkpoint.com/app/i2/graphql/V1 \
        --header "authorization: Bearer ${TOKEN}" \
        --header 'content-type: application/json' \
        --data "$BODY_NEWWEBASSET")

    ERRORS=$(echo "$RESP" | jq -r '.errors')
    # echo "$ERRORS"
    if [ "$ERRORS" = "null" ]; then
        echo "Success creating new web app asset"
    else
        echo "Error when creating new web app asset"
        ERR=$(echo "$RESP" | jq -r '.errors[0].message')
        echo "   ${ERR}. Exiting..."
        exit 1
    fi

    NEWASSET=$(echo "$RESP" | jq -r '.data')
    echo "$NEWASSET"
}

source /usr/local/bin/appsec-keys.sh

echo
echo "Getting API token"
getToken "${HORIZON_POLICY_CLIENTID}" "${HORIZON_POLICY_SECRETKEY}"

echo "Getting Web App Best Practice id"
getBestPractice

echo "Getting Linux Agents profile id"
LINUXPROFILEID=$(getLinuxAgents)
echo "$LINUXPROFILEID"

# save for verification of step!
echo "$APP_URL" > /tmp/appurl

APP_URL1=$(echo "$APP_URL" | sed s/^https:/http:/)
echo "Creating new web app asset for $APP_URL1 on profile $LINUXPROFILEID"
newWebAsset "$APP_URL1"


echo "Publishing changes"
publishChanges

echo "Enforcing policy"
enforcePolicyAndWait

echo "Getting Linux Agents profile installation token"
PROFILETOKEN=$(getProfileToken "$LINUXPROFILEID")
echo "$PROFILETOKEN"
echo "Running wget https://sc1.checkpoint.com/nanoegg/cp-nano-egg -O nanoegg && chmod +x nanoegg && ./nanoegg --install --token $PROFILETOKEN"
echo 
echo "Installing AppSec Agent..."
wget https://sc1.checkpoint.com/nanoegg/cp-nano-egg -O nanoegg && chmod +x nanoegg && ./nanoegg --install --token "$PROFILETOKEN"

echo
echo "Done"