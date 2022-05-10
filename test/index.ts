import { expect } from "chai";
import { ethers, network } from "hardhat";
import { waffle } from "hardhat";
import { Contract, Wallet } from "ethers";
import {
  GOVERNOR_BRAVO_ABI,
  TIMELOCK_ABI,
  ENS_REGISTRY_ABI,
  ENS_PUBLIC_RESOLVER_ABI,
  UNI_ABI,
} from "./abis";
import { namehash } from "@ethersproject/hash";
import { keccak256 } from "@ethersproject/keccak256";
import { utils } from "ethers";
import { Interface } from "@ethersproject/abi";
import "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

const { provider } = waffle;

// NOTE: to run this simulation for any other additional use grants,
// change the LICENSE_GRANTEE to reflect who is requesting an Additional Use Grant
const EXPECTED_CURRENT_PROPOSAL_COUNT = 18;
const EXPECTED_NEW_PROPOSAL_NUMBER = EXPECTED_CURRENT_PROPOSAL_COUNT + 1;
const LICENSE_GRANTEE = "Illusory Systems, Inc.";
const CHAIN_NAME = "the Moonbeam blockchain";

// replace PROPOSAL_DESCRIPTION with the information for the proposal
const PROPOSAL_DESCRIPTION = `# Deploy Uniswap V3 on Moonbeam \n
### Summary \n
\n
In support of furthering the vision of [Multichain Uniswap](https://uniswap.org/blog/multichain-uniswap), we at [Blockchain at Berkeley](https://blockchain.berkeley.edu/) are partnering with [Nomad](https://app.nomad.xyz/) to propose that the Uniswap community authorize Nomad (Illusory Systems, Inc) to deploy Uniswap V3 to [Moonbeam](https://moonbeam.network/). \n
\n
The timeline for deployment will be approximately 3-4 weeks following the completion of this Governance Proposal.
\n
### Proposal Links \n
- Governance Proposal: [discussion](https://gov.uniswap.org/t/governance-proposal-deploy-uniswap-v3-on-moonbeam/16759) \n
- Consensus Check: [discussion](https://gov.uniswap.org/t/consensus-check-deploy-uniswap-v3-to-moonbeam/16624), [snapshot](https://snapshot.org/#/uniswap/proposal/QmcVpxCSkL8rPmZgow8uL2GbdPZtUKS3huY9aSExKNfEK6) (passed with 9.6M UNI in favor) \n
- Temperature Check: [discussion](https://gov.uniswap.org/t/temperature-check-deploy-uniswap-v3-on-moonbeam/16572), [snapshot](https://snapshot.org/#/uniswap/proposal/QmaG6nJYW3xLeQwAa6xxhpbuYS8h6PVQpbx1vfqpqxAtik) (passed with 8.3M UNI in favor) \n
\n
\n
### Description \n
Moonbeam is a Polkadot parachain which features EVM-compatibility, allowing it to serve as a port-of-entry for Ethereum-native apps to participate in the greater Polkadot ecosystem. \n
\n 
We believe deploying Uniswap to Moonbeam will bring the following benefits to the Uniswap community:  \n
* **Expansion into Polkadot**: Uniswap will be able to tap into a brand new market and all the community members in the Polkadot ecosystem. Moonbeam’s EVM-compatibility makes it simple to deploy existing Solidity code, while simultaneously providing access to other parachains using XCM. By leveraging XCM and Moonbeam’s position as the DeFi hub for Polkadot, Uniswap has the opportunity to become the premier AMM across Polkadot. \n
* **Trust-minimized Governance**: Per Uniswap’s goal of becoming a multi-chain protocol while remaining trust-minimized, we propose using Nomad’s trust-minimized channels to deploy Uniswap V3 on Moonbeam. This can serve as an opportunity to test this improved decentralized governance application within a safe container, with the potential of rolling it out to other V3 deployments in the future. \n
* **Rewards for Uniswap Grants Program**: Instead of simply offering liquidity mining incentives, we want to fund community members working to develop and enrich multichain experiences built with Uniswap. The Moonbeam Foundation will commit $2.5M to the Uniswap Grants Program to fund cross-chain development deployed within the Uniswap ecosystem, in order to further expand Uniswap’s multi-chain presence. \n
`;

// construct proposal code
const NODE: string = namehash("v3-core-license-grants.uniswap.eth");
const KEY: string = `${LICENSE_GRANTEE} Uni v3 Additional Use Grant`;
const VALUE: string = `
    ${LICENSE_GRANTEE} Uni v3 Additional Use Grant
    ${LICENSE_GRANTEE} are granted an additional use grant to use the Uniswap V3 Core software code (which is made available to ${LICENSE_GRANTEE} subject to license available at https://github.com/Uniswap/v3-core/blob/main/LICENSE (the “Uniswap Code”)). As part of this additional use grant, ${LICENSE_GRANTEE} receives license to use the Uniswap Code for the purposes of a full deployment of the Uniswap Protocol v3 onto ${CHAIN_NAME}. ${LICENSE_GRANTEE} is permitted to use subcontractors to do this work. This license is conditional on ${LICENSE_GRANTEE} complying with the terms of the Business Source License 1.1, made available at https://github.com/Uniswap/v3-core/blob/main/LICENSE.`;

const PUBLIC_ENS_RESOLVER_ADDRESS: string =
    "0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41";

async function advanceBlockHeight(blocks: number) {
  const txns = [];
  for (let i = 0; i < blocks; i++) {
    txns.push(network.provider.send("evm_mine"));
  }
  await Promise.all(txns);
}

async function voteAndExecuteProposal(governorBravo: Contract, a16zSigner: SignerWithAddress) {
  // print current number of proposals
  const currentProposalCount = await governorBravo.proposalCount();
  expect(currentProposalCount).to.eq(EXPECTED_NEW_PROPOSAL_NUMBER);
  console.log("current number of proposals created: " + currentProposalCount);

  // print proposal info
  let proposalInfo = await governorBravo.proposals(EXPECTED_NEW_PROPOSAL_NUMBER);
  console.log(proposalInfo);

  // fast forward through review period
  await advanceBlockHeight(13141);

  const uniWhaleAddresses = [
    "0x2b1ad6184a6b0fac06bd225ed37c2abc04415ff4",
    "0xe02457a1459b6c49469bf658d4fe345c636326bf",
    "0x8e4ed221fa034245f14205f781e0b13c5bd6a42e",
    "0x61c8d4e4be6477bb49791540ff297ef30eaa01c2",
    "0xa2bf1b0a7e079767b4701b5a1d9d5700eb42d1d1",
    "0xe7925d190aea9279400cd9a005e33ceb9389cc2b",
    "0x7e4a8391c728fed9069b2962699ab416628b19fa",
  ];

  // submit votes in favor of the proposal
  for (let i = 0; i < uniWhaleAddresses.length; i++) {
    const whaleAddress = uniWhaleAddresses[i];
    const whaleSigner = await getFundedSigner(whaleAddress);
    await governorBravo.connect(whaleSigner).castVote(EXPECTED_NEW_PROPOSAL_NUMBER, 1);
  }

  // fast forward through voting period
  await advanceBlockHeight(40320);

  // queue the proposal
  await governorBravo.connect(a16zSigner).queue(EXPECTED_NEW_PROPOSAL_NUMBER);
  proposalInfo = await governorBravo.proposals(EXPECTED_NEW_PROPOSAL_NUMBER);
  console.log(proposalInfo);

  // change the time on-chain to expend 2 days queue period
  await network.provider.request({
    method: "evm_increaseTime",
    params: [172800],
  });
  await advanceBlockHeight(1);

  // execute proposal
  await governorBravo.connect(a16zSigner).execute(EXPECTED_NEW_PROPOSAL_NUMBER);
  proposalInfo = await governorBravo.proposals(EXPECTED_NEW_PROPOSAL_NUMBER);
  console.log(proposalInfo); // expect "executed"
}

async function expectLicenseText(expectedText: string) {
  const ensPublicResolver = new Contract(
      PUBLIC_ENS_RESOLVER_ADDRESS,
      ENS_PUBLIC_RESOLVER_ABI,
      provider
  );
  const licenseText = await ensPublicResolver.text(NODE, KEY);
  console.log(licenseText);
  expect(licenseText).to.eq(expectedText);
}

async function getFundedSigner(signerAddress: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [signerAddress], // a16z
  });

  const signer = await ethers.getSigner(signerAddress);

  // transfer ether to a16z to execute the delegation transaction
  const [wallet] = await (ethers as any).getSigners();
  await wallet.sendTransaction({
    to: signerAddress,
    value: ethers.utils.parseEther("1"),
  });

  return signer;
}

describe("Uniswap additional use grant simulation", async () => {
  it("proposal simulation", async () => {
    const blockNumber = (await provider.getBlock("latest")).number;
    console.log("blockNumber OLD", blockNumber);

    // get the governor bravo contract
    const governorBravoAddress = "0x408ED6354d4973f66138C91495F2f2FCbd8724C3";
    const governorBravo = new Contract(
      governorBravoAddress,
      GOVERNOR_BRAVO_ABI,
      provider
    );

    // get the ENS public resolver
    const ensPublicResolverInterface = new Interface(ENS_PUBLIC_RESOLVER_ABI);
    // encode calldata to set Text on the resolver
    const setTextCalldata = ensPublicResolverInterface.encodeFunctionData(
      "setText",
      [NODE, KEY, VALUE]
    );

    // populate values for Uniswap governance transaction
    const targets = [PUBLIC_ENS_RESOLVER_ADDRESS];
    const values = [0];
    const sigs = [""];
    const calldatas = [setTextCalldata];

    // print proposal transaction values
    console.log("targets: ", JSON.stringify(targets, null, 2));
    console.log("values: ", JSON.stringify(values, null, 2));
    console.log("sigs: ", JSON.stringify(sigs, null, 2));
    console.log("calldatas: ", JSON.stringify(calldatas, null, 2));
    console.log("description: ", PROPOSAL_DESCRIPTION);

    // create the proposal transaction
    const proposalTransaction = await governorBravo.populateTransaction.propose(targets, values, sigs, calldatas, PROPOSAL_DESCRIPTION);
    console.log("transaction: ", JSON.stringify(proposalTransaction, null, 2));

    // before submitting, expect that license text is empty before submitting the proposal
    await expectLicenseText("");

    // before submitting, there should be the expected number of proposals
    const currentProposalCount = await governorBravo.proposalCount();
    console.log("currentProposalCount", currentProposalCount);
    expect(currentProposalCount).to.eq(EXPECTED_CURRENT_PROPOSAL_COUNT);

    // submit the proposal
    const a16zAddress = "0x2B1Ad6184a6B0fac06bD225ed37C2AbC04415fF4";
    const proposer = await getFundedSigner(a16zAddress);
    await proposer.sendTransaction(proposalTransaction);

    // after submitting, check ens records are not yet updated
    await expectLicenseText("");

    // go through successful governance process:
    // submit votes & execute the proposal
    await voteAndExecuteProposal(governorBravo, proposer);

    // after executing, check ens records are correctly updated
    await expectLicenseText(VALUE);
  });
});
