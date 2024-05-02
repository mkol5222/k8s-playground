#!/usr/bin/env -S deno run --allow-env --allow-read --allow-net
import { load } from "jsr:@std/dotenv";
import { Command, EnumType } from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
import { stringify } from "jsr:@std/csv";

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
            clientId: CGWAF_ID,
            secretKey: CGWAF_KEY
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

async function getToken(config: WafConfig): Promise<AuthResponse> {
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


async function publishRequest(token: string) {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            query: "mutation {\n publishChanges {\n isValid\n errors {\n id type subType name message \n }\n warnings {\n id type subType name message\n }\n }\n }"
        })
    });
    const responseJson = await response.json();
    // console.log(responseJson);
    return responseJson;
}

async function deleteAssetRequest(token: string, id: string) {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            variables: { id },
            query: "mutation deleteAsset($id: String!) {\n deleteAsset(id: $id) }"
        })
    });
    const responseJson = await response.json();
    console.log(responseJson);
    return responseJson;
}

async function deleteProfileRequest(token: string, id: string) {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            variables: { id },
            query: "mutation deleteProfile($id: ID!) {\n deleteProfile(id: $id) }"
        })
    });
    const responseJson = await response.json();
    console.log(responseJson);
    return responseJson;
}


async function getPracticesRequest(token: string, matchSearch: string = "") {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            variables: { matchSearch },
            query: `query getPractices($matchSearch: String) {
                getPractices(includePrivatePractices: false, matchSearch:$matchSearch) {
                    id name
                }
            }`
        })
    });
    const responseJson = await response.json();
    console.log(responseJson);
    return responseJson;
}

async function getPractices(token: string, matchSearch: string = "") {
    const practices = await getPracticesRequest(token, matchSearch);
    if (practices.data.getPractices) {
        return practices.data.getPractices;
    }
    return [];
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

async function getProfilesRequest(token: string, matchSearch: string = ""): Promise<GetProfilesResponse> {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            variables: { matchSearch },
            query: `query getProfiles($matchSearch: String) {
                getProfiles(matchSearch:$matchSearch) {
                    id name profileType
                }
            }`
        })
    });
    const responseJson = await response.json();
    //console.log(responseJson);
    return responseJson;
}

async function getProfiles(token: string, matchSearch: string = "", profileType: string = "") {
    const profiles = await getProfilesRequest(token, matchSearch);
    if (profiles.data.getProfiles) {
        const items = profiles.data.getProfiles;
        if (profileType.length > 0) {
            return items.filter(profile => profile.profileType === profileType);
        }
        return items;
    }
    return [];

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

async function getWebApplicationAssets(token: string, matchSearch: string = "", profileIName: string = "") {
    const assets = await getAssetsRequest(token, matchSearch);
    if (assets.data.getAssets) {
        const webAppAssets = assets.data.getAssets.assets.filter(asset => asset.assetType === "WebApplication");

        if (profileIName.length > 0) {
            return webAppAssets.filter(asset => asset.profiles.some(profile => profile.name === profileIName));
        }
        return webAppAssets;
    }
    return [];
}

async function getSaasProfileCertificateDomainsRequest(token: string, profileId: string) {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            operationName: "Profile",
            variables: {
                id: profileId
            },
            query: `query Profile($id: ID!) {  
                getProfile(id: $id) { 
                    id name profileType 
                    ... on AppSecSaaSProfile { 
                        certificatesDomains { 
                            id domain cnameName cnameValue certificateValidationStatus 
                        } 
                    } 
                } 
            }`
        })
    });
    const responseJson = await response.json();
    //console.log(responseJson);
    return responseJson;
}

async function getSaasProfileCertificateDomains(token: string, profileId: string) {
    const certificateDomains = await getSaasProfileCertificateDomainsRequest(token, profileId);
    if (certificateDomains.data.getProfile) {
        return certificateDomains.data.getProfile.certificatesDomains;
    }
    return [];
}



type SaasDomainsCnameRequestOptions = {
    region: string,
    domains: string[],
    profileId: string
}

async function getSaasDomainCnamesRequest(token: string, options: SaasDomainsCnameRequestOptions) {
    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            variables: {
                "region": options.region || "eu-west-1",
                "domains": options.domains,
                "profileId": options.profileId
            },
            query: "query PublicCNAME($region: String, $domains: [String], $profileId: String) {\n  getPublicCNAME(region: $region, domains: $domains, profileId: $profileId) { domain cname }\n}\n"
        })
    });
    const responseJson = await response.json();
    // console.log(responseJson);
    return responseJson;
}

async function getSaasDomainCnames(token: string, options: SaasDomainsCnameRequestOptions) {

    const cnames = await getSaasDomainCnamesRequest(token, options);
    if (cnames.data.getPublicCNAME) {
        return cnames.data.getPublicCNAME;
    }
    return [];
}

type NewWebAppAssetOptions = {
    name: string,
    URLS: string[],
    upstreamURL: string,
    profiles: string[],
    practiceId: string
    practiceMode: string
    hostHeader?: string
}

async function newWebApplicationAssetRequest(token: string, options: NewWebAppAssetOptions) {

    const variables = {
        assetInput: {
            name: options.name,
            URLs: options.URLS,
            upstreamURL: options.upstreamURL,
            profiles: options.profiles,
            practices: {
                practiceId: options.practiceId
            }
        }
    }
    if (options.hostHeader) {
        variables.assetInput.proxySetting = [
            { key: "setHeader", value: `Host:${options.hostHeader}` },
            { key: "isSetHeader", value: "true" }
        ]
    }

    const response = await fetch("https://cloudinfra-gw.portal.checkpoint.com/app/waf/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
            variables,
            query: `
            mutation newWebAppAsset($assetInput:WebApplicationAssetInput!)  {
                newWebApplicationAsset(assetInput:$assetInput) {
                id name
              }
            }
            `
        })
    });
    const responseJson = await response.json();
    console.log(responseJson);
    return responseJson;
}

async function getPracticeId(token: string, practiceName: string) {
    const practices = await getPractices(token, practiceName);
    if (practices.length > 0) {
        return practices[0].id;
    }
    return null;
}

async function getWebApplicationBestPracticeId(token: string) {
    return getPracticeId(token, "WEB APPLICATION BEST PRACTICE");
}

async function getProfileId(token: string, profileName: string) {
    const profiles = await getProfiles(token, profileName);
    if (profiles.length > 0) {
        return profiles[0].id;
    }
    return null;
}

async function getAssetId(token: string, assetName: string) {
    const assetsData = await getAssetsRequest(token, assetName);
    if (assetsData.data.getAssets) {
        const assets = assetsData.data.getAssets.assets;
        const asset = assets.find(asset => asset.name === assetName);
        if (asset) {
            return asset.id;
        }
    }
    return null;
}

async function demo() {

    const config = await loadConfig();
    const token: AuthResponse = await getToken(config);


    const profilesResp = await getProfilesRequest(token.data.token, "feb15");
    console.log(JSON.stringify(profilesResp, null, 2));

    const assetsData = await getAssetsRequest(token.data.token, "nip");
    console.log(JSON.stringify(assetsData, null, 2));

    const assets = await getWebApplicationAssets(token.data.token);
    console.log(JSON.stringify(assets, null, 2));

    const assetsKind = await getWebApplicationAssets(token.data.token, "", "kind-profile");
    console.log(JSON.stringify(assetsKind, null, 2));

    const profiles = await getProfiles(token.data.token, "feb15", "AppSecSaaS");
    console.log(JSON.stringify(profiles, null, 2));

    if (profiles.length > 0) {
        const saasProfile = profiles[0];
        const saasProfileCertificateDomains = await getSaasProfileCertificateDomains(token.data.token, saasProfile.id);
        console.log(JSON.stringify(saasProfileCertificateDomains, null, 2));

        const domainNames = saasProfileCertificateDomains.map(domain => domain.domain);
        console.log(domainNames);

        const cnames = await getSaasDomainCnames(token.data.token, {
            region: "eu-west-1",
            domains: domainNames,
            profileId: saasProfile.id
        });
        console.log(JSON.stringify(cnames, null, 2));
    }
    //getSaasProfileCertificateDomainsRequest

    const practices = await getPractices(token.data.token, "WEB APPLICATION BEST PRACTICE");
    console.log(JSON.stringify(practices, null, 2));

    const practiceId = await getWebApplicationBestPracticeId(token.data.token)
    console.log(practiceId);

    const profileId = await getProfileId(token.data.token, "feb15");
    console.log(profileId);

    if (practiceId && profileId) {
        const res = await newWebApplicationAssetRequest(token.data.token, {
            name: "devto.klaud.online",
            URLS: ["https://devto.klaud.online"],
            upstreamURL: "https://dev.to",
            profiles: [profileId],
            practiceId: practiceId,
            practiceMode: "Prevent",
            hostHeader: "dev.to"
        });

        console.log(JSON.stringify(res, null, 2));
    }


    const assetId = await getAssetId(token.data.token, "devto.klaud.online");
    console.log(assetId);

    // if (assetId) {
    //     console.log("Deleting asset");
    //     const res = await deleteAssetRequest(token.data.token, assetId);
    //     console.log(JSON.stringify(res, null, 2));
    // }

    const profileIdToDelete = await getProfileId(token.data.token, "deleteme");
    console.log('profile 2 delete', profileIdToDelete);
    if (profileIdToDelete) {
        console.log("Deleting profile");
        const res = await deleteProfileRequest(token.data.token, profileIdToDelete);
        console.log(JSON.stringify(res, null, 2));

    }

    const publish = await publishRequest(token.data.token);
    console.log(JSON.stringify(publish, null, 2));
}

function processOutput(data, outputType: string) {
    switch (outputType) {
        case 'json':
            console.log(JSON.stringify(data, null, 2));
            break;
        case 'table':
            console.table(data);
            break;
        case 'csv':
            if (data && data.length > 0) {
                
                const fields = Object.keys(data[0]);
                const csvData = stringify(data, { header: true, columns: fields });
                console.log(csvData);
            } else {
                console.error("No data to export");
            }
            break;
    }
}

enum OutputType {
    Json = "json",
    Table = "table",
    Csv = "csv",
}

// Enum type with enum.
const output = new EnumType(OutputType);

await new Command()
    .type("output", output)
    .globalOption("-o, --output [output:output]", "Output format", {default: "json"})

    //.action(console.log)
    .command(
        "asset",
        new Command()
            .description("manage assets")
            .command(
                "ls",
                new Command()
                    .description("list assets")
                    .option("-f, --filter [filter:string]", "filter by name substring", { default: "" })
                    .action(async (options, ...args) => {
                        const { output, filter } = options;
                        const config = await loadConfig();
                        const token: AuthResponse = await getToken(config);
                        const assets = await getWebApplicationAssets(token.data.token, filter);
                        processOutput(assets, output);
                    })

            )
            .command("rm", "delete asset by name or id")
            .option("-i, --id <id:string>", "Asset id.", {})
            .option("-n, --name <name:string>", "Asset name.", { conflicts: ["id"] })
            .action((options, ...args) => console.log("asset rm called.", options, args))
        ,
    )
    .command("profile",
        new Command()
            .description("manage profiles")
            .command(
                "ls",
                new Command()
                    .description("list profiles")
                    .option("-f, --filter [filter:string]", "filter by name substring", { default: "" })
                    .action(async (options, ...args) => {
                        const { output, filter } = options;
                        const config = await loadConfig();
                        const token: AuthResponse = await getToken(config);
                        const profiles = await getProfiles(token.data.token, filter);
                        processOutput(profiles, output);
                    })

            )
    )
    .command("dns",
    new Command()
        .description("manage SaaS DNS records (CNAMES)")
        .command(
            "cert-cnames",
            new Command()
                .description("list CNAMES to validate domain ownership for certificates")
                .action(async (options, ...args) => {
                    // console.log("asset ls called.", options, args)
                    const { output } = options;
                    const config = await loadConfig();
                    const token: AuthResponse = await getToken(config);
                    const saasProfiles = await getProfiles(token.data.token, "", "AppSecSaaS");
                    //console.log(JSON.stringify(saasProfiles, null, 2));
                    const cnames = [];
                    for (const saasProfile of saasProfiles) {
                        const saasProfileCertificateDomains = await getSaasProfileCertificateDomains(token.data.token, saasProfile.id);
                       
                        for (const cname of saasProfileCertificateDomains) {
                            cnames.push({ ...cname, profileName: saasProfile.name, prodileId: saasProfile.id});
                                
                        } 
                    }
                    processOutput(cnames, output);
                })
        )
        .command(
            "public-cnames",
            new Command()
                .description("list public (protection) CNAMES for SaaS profiles")
                .action(async (options, ...args) => {
                    // console.log("asset ls called.", options, args)
                    const { output } = options;
                    const config = await loadConfig();
                    const token: AuthResponse = await getToken(config);
                    const saasProfiles = await getProfiles(token.data.token, "", "AppSecSaaS");
                    //console.log(JSON.stringify(saasProfiles, null, 2));
                    const cnames = [];
                    for (const saasProfile of saasProfiles) {
                        const saasProfileCertificateDomains = await getSaasProfileCertificateDomains(token.data.token, saasProfile.id);
                       
                        const domainNames = saasProfileCertificateDomains.map(domain => domain.domain);
                        const cnamesData = await getSaasDomainCnames(token.data.token, {
                            region: "eu-west-1",
                            domains: domainNames,
                            profileId: saasProfile.id
                        });
                        for (const cname of cnamesData) {
                            cnames.push(cname);
                        }
                    }
                    processOutput(cnames, output);
                })
        )
)
    .parse(Deno.args);
