#!/usr/bin/env -S deno run --allow-env --allow-read --allow-net
import { load } from "jsr:@std/dotenv";

const URL_AUTH = "https://cloudinfra-gw.portal.checkpoint.com/auth/external"
const URL_WAF = 'https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql'

type WafConfig = {
    waf: {
        clientId: string,
        secretKey: string
    }
}

async function loadConfig(): Promise<WafConfig> {
    const env = await load();
    const CGWAF_ID = env.CGWAF_ID;
    const CGWAF_KEY = env.CGWAF_KEY;
    // console.log(env.CGWAF_ID)
    // console.log(env.CGWAF_KEY)

    if (!CGWAF_ID || !CGWAF_KEY) {
        console.error("Please set CGWAF_ID and CGWAF_KEY in .env file");
        Deno.exit(1);
    }
    return {
        waf: {
            clientId:CGWAF_ID,
            secretKey:CGWAF_KEY
        }
    }
}

type AuthResponse = {
    success: boolean,
    data: {
        token: string,
        csrf: string,
        expires: string,
        expiresIn: number
    }
}

async function getToken(config: WafConfig): AuthResponse {
    const response = await fetch(URL_AUTH, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientId: config.waf.clientId,
            accessKey: config.waf.secretKey
        })
    });
    const responseJson = await response.json();
    //console.log(responseJson);
    return responseJson;
}

type GetProfilesResponse = {
    data: {
        getProfiles: {
            id: string,
            name: string,
            profileType: string
        }[]
    }
}

async function getProfilesRequest(token: string): Promise<GetProfilesResponse> {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            query: `{
                getProfiles {
                    id name profileType
                }
            }`
        })
    });
    const responseJson = await response.json();
    //console.log(responseJson);
    return responseJson;
}

async function getAssetsRequest(token: string, matchSearch: string = "") {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            variables: { matchSearch },
            query: `
            query getAssets($matchSearch: [String])  {
                    getAssets(matchSearch:$matchSearch) {
                      status
                        assets {
                          id
                          name
                          assetType
                          profiles { id name }
                          practices { practice { id name  }}
                        }
                    }
                  }
            `
        })
    });
    const responseJson = await response.json();
    //console.log(responseJson);
    return responseJson;
}



const config = await loadConfig();
const token: AuthResponse = await getToken(config);


const profiles = await getProfilesRequest(token.data.token);
console.log(JSON.stringify(profiles, null, 2));

const assets = await getAssetsRequest(token.data.token, "nip");
console.log(JSON.stringify(assets, null, 2));