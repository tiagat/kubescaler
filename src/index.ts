import csv from "csvtojson";
import { KubeConfig, AppsV1Api, V1Deployment } from '@kubernetes/client-node';
import { Command } from "commander";
import { CSVParseParam } from "csvtojson/v2/Parameters";

const program = new Command();

interface Options {
  file: string;
  kubeconfig: string;
}

interface Deployment {
  name: string;
  namespace: string;
  pods: string;
  replicas: number;
  age: number;
  condition: string;
}

async function readFile(file: string): Promise<Deployment[]> {
  const params: Partial<CSVParseParam> = {
    headers: ["name", "namespace", "pods", "replicas", "age", "condition"],
    colParser: {
      replicas: "number",
      age: "number",
    },
  };
  const deployments = await csv(params).fromFile(file);
  return deployments;
}

async function scaleDeployment(namespace: string, name: string, replicas: number) {
  const { kubeconfig } = program.opts<Options>();
  const k8sConfig = new KubeConfig();
  
  if (kubeconfig) {
    k8sConfig.loadFromFile(kubeconfig)
  } 
  else {
    k8sConfig.loadFromDefault();
  }

  const k8sApi = k8sConfig.makeApiClient(AppsV1Api);
  const { body } = await k8sApi.readNamespacedDeployment(name, namespace);
  
  if (body.spec) {
    console.log(`Scaling deployment: ${namespace}/${name} to ${replicas}`);
    body.spec!.replicas = replicas;
    await k8sApi.replaceNamespacedDeployment(name, namespace, body);
  }
  
}

async function up() {
  const { file } = program.opts<Options>();
  const deployments = await readFile(file);
  for (const deployment of deployments) {
    await scaleDeployment(deployment.namespace, deployment.name, deployment.replicas);
  }
}

async function down() {
  const { file } = program.opts<Options>();
  const deployments = await readFile(file);
  for (const deployment of deployments) {
    await scaleDeployment(deployment.namespace, deployment.name, 0);
  }
}

async function main() {
  program
    .name("kubescaler")
    .description("Kubernetes deployment scale helper")
    .version("1.0.0")
    .requiredOption(
      "-f, --file <file>",
      "Lens export workload deployments (*.csv)"
    )
    .option(
      "-k, --kubeconfig <kubeconfig>",
      "Kubeconfig file path",
    )
    ;

  program.command("up").action(up);
  program.command("down").action(down);

  await program.parseAsync(process.argv);
}

main().catch(console.error);
