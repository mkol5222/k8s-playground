#!/usr/bin/env -S deno run --allow-env --allow-read --allow-net
import { load } from "jsr:@std/dotenv";
import Cloudflare from "npm:cloudflare";
import {
  Command,
  EnumType,
} from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
import { stringify } from "jsr:@std/csv";

async function loadConfig() {
  const env = await load();
  const CLOUDFLARE_DNS_API_TOKEN = env.CLOUDFLARE_DNS_API_TOKEN;
  const CLOUDFLARE_ZONE_ID = env.CLOUDFLARE_ZONE_ID;
  // console.log(env.CGWAF_ID)
  // console.log(env.CGWAF_KEY)

  if (!CLOUDFLARE_DNS_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    console.error(
      "Please set CLOUDFLARE_ZONE_ID and CLOUDFLARE_DNS_API_TOKEN in .env file",
    );
    Deno.exit(1);
  }
  return {
    cf: {
      zoneId: CLOUDFLARE_ZONE_ID,
      apiToken: CLOUDFLARE_DNS_API_TOKEN,
    },
  };
}

enum OutputType {
  Json = "json",
  Table = "table",
  Csv = "csv",
}

function processOutput(output: OutputType, data: any) {
  switch (output) {
    case OutputType.Json:
      console.log(JSON.stringify(data, null, 2));
      break;
    case OutputType.Table:
      console.table(data);
      break;
    case OutputType.Csv:
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

// Enum type with enum.
const output = new EnumType(OutputType);

async function cmdList(options) {
  const { output, wide } = options;
  const config = await loadConfig();
  const cloudflare = new Cloudflare({ apiToken: config.cf.apiToken });
  const records = await cloudflare.dns.records.list({
    zone_id: config.cf.zoneId,
    search: options.filter.length > 0 ? options.filter : undefined,
    name: options.name.length > 0 ? options.name : undefined,
  });
  let data = records.result;
  if (!wide) {
    data = data.map((record) => {
      const { id, type, name, content, ttl } = record;
      return { id, type, name, content, ttl };
    });
  }
  if (options.filter.length > 0) {
    data = data.filter((record) => record.name.includes(options.filter));
  }
  if (options.type.length > 0) {
    data = data.filter((record) => record.type === options.type);
  }

  processOutput(output, data);
}

async function cmdDelete(options) {
  const { output, wide } = options;
  const config = await loadConfig();
  const cloudflare = new Cloudflare({ apiToken: config.cf.apiToken });
  const records = await cloudflare.dns.records.list({
    zone_id: config.cf.zoneId,
    name: options.name.length > 0 ? options.name : undefined,
  });
  let data = records.result;

  if (data.length > 0) {
    const record = data[0];
    const result = await cloudflare.dns.records.delete(record.id, {
      zone_id: config.cf.zoneId,
    });
    console.log("Deleted:", result);
  } else {
    console.error("No records found");
  }
}

async function cmdCreate(options) {
  console.log("Create record", options);

  const config = await loadConfig();
  const cloudflare = new Cloudflare({ apiToken: config.cf.apiToken });
  const record = {
    type: options.type,
    name: options.name,
    content: options.content,
    ttl: options.ttl,
  };
  const result = await cloudflare.dns.records.create({
    zone_id: config.cf.zoneId,
    ...record,
  });
  console.log(result);
}

async function cmdUpdate(options) {
  console.log("Update record", options);

  const config = await loadConfig();
  const cloudflare = new Cloudflare({ apiToken: config.cf.apiToken });

  const records = await cloudflare.dns.records.list({
    zone_id: config.cf.zoneId,
    name: options.name.length > 0 ? options.name : undefined,
  });
  let data = records.result;

  if (data.length > 0) {
    const existingRecord = data[0];
    const record = {
      type: options.type,
      name: options.name,
      content: options.content,
      ttl: options.ttl,
    };
    const result = await cloudflare.dns.records.update(existingRecord.id, {
      zone_id: config.cf.zoneId,
      ...record,
    });
    console.log(result);
  } else {
    console.error("No records found to be updated. Creating new record");
    const record = {
      type: options.type,
      name: options.name,
      content: options.content,
      ttl: options.ttl,
    };
    const result = await cloudflare.dns.records.create({
      zone_id: config.cf.zoneId,
      ...record,
    });
    console.log(result);
  }
}

async function main() {
  new Command()
    .type("output", output)
    .globalOption("-o, --output [output:output]", "Output format", {
      default: "json",
    })
    .globalOption("--wide [wide:boolean]", "Full wide output", {
      default: false,
    })
    .description("Cloudflare DNS CLI")
    .version("0.1.0")
    .command(
      "list",
      new Command().description("List all records")
        .option("-f, --filter [filter:string]", "search by filter", {
          default: "",
        })
        .option("-n, --name [name:string]", "full name", {
          default: "",
        })
        .option(
          "-t, --type [type:string]",
          "DNS record type - e.g. CNAME, A etc.",
          {
            default: "",
          },
        )
        .action(cmdList),
    )
    .command(
      "create",
      new Command().description("Create a new record")
        .option(
          "-t, --type <type:string>",
          "DNS record type - e.g. CNAME, A etc.",
          { default: "CNAME", required: true },
        )
        .option("-n, --name <name:string>", "DNS record name", {
          required: true,
        })
        .option("-c, --content <content:string>", "DNS record content", {
          required: true,
        })
        .option("--ttl <ttl:number>", "DNS record TTL", { default: 3600 })
        .action(cmdCreate),
    )
    .command(
      "update",
      new Command().description("Update record by name")
        .option(
          "-t, --type <type:string>",
          "DNS record type - e.g. CNAME, A etc.",
          { default: "CNAME", required: true },
        )
        .option("-n, --name <name:string>", "DNS record name", {
          required: true,
        })
        .option("-c, --content <content:string>", "DNS record content", {
          required: true,
        })
        .option("--ttl <ttl:number>", "DNS record TTL", { default: 3600 })
        .action(cmdUpdate),
    )
    .command(
      "delete",
      new Command().description("Delete new record by name")
        .option("-n, --name <name:string>", "DNS record name", {
          required: true,
        })
        .action(cmdDelete),
    )
    .parse(Deno.args);
}

await main();
