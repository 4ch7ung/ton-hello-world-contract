import { Address, Cell, StateInit, address, beginCell, contractAddress, storeStateInit, toNano } from "@ton/core";
import { compile, NetworkProvider, sleep } from "@ton/blueprint";

import dotenv from "dotenv";
import { MainContract } from "../../ton-hello-world-frontend/src/contracts/MainContract";
dotenv.config();

export async function run(provider: NetworkProvider) {
    const codeCell = await compile("MainContract");
    const myContract = MainContract.createFromConfig({
        sender_address: address("kQAomCdjy5XAE7u1HP294s6rL3suN4B_sPu3Hbx06OgNWqzH"),
        initial_sum: 0,
        owner_address: address("kQAomCdjy5XAE7u1HP294s6rL3suN4B_sPu3Hbx06OgNWqzH")
    }, codeCell);

    const openContract = provider.open(myContract);

    openContract.sendDeploy(provider.sender(), toNano(0.01));

    await provider.waitForDeploy(openContract.address, 10, 2000);
}