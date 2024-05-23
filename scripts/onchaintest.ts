import { Address, Cell, beginCell, contractAddress, toNano } from "@ton/core";
import { getHttpV4Endpoint } from "@orbs-network/ton-access";
import { TonClient4 } from "@ton/ton";
import qs from "qs";
import qrcode from "qrcode-terminal";
import { compile } from "@ton/blueprint";

import dotenv from "dotenv";
dotenv.config();

async function onChainTestScript() {

    const testnet = process.env.TESTNET;

    console.log(
        "======================="
    );

    console.log(
        "On-chain test script is running, generating test link for main.fc contract on the testnet..."
    );

    const codeCell = await compile("MainContract");
    let zeroAddress = new Address(0, Buffer.alloc(32));
    const dataCell = beginCell()
        .storeBuffer(zeroAddress.toRaw())
        .storeInt(0, 32)
        .endCell();

    const address = contractAddress(0, {
        code: codeCell,
        data: dataCell
    });

    const endpoint = await getHttpV4Endpoint({
        network: testnet ? "testnet" : "mainnet"
    });
    const client4 = new TonClient4({ endpoint });

    const latestBlock = await client4.getLastBlock();
    let status = await client4.getAccount(latestBlock.last.seqno, address);

    if (status.account.state.type !== "active") {
        console.log("Contract is not deployed yet");
        return;
    }

    let link = `https://${testnet ? "test." : ""}tonhub.com/transfer/` +
    address.toString({ testOnly: testnet ? true : false }) +
        "?" +
        qs.stringify({
            text: "Simple test transaction",
            amount: toNano(0.001).toString(10),
            bin: beginCell().storeInt(1, 32).endCell().toBoc().toString("base64")
        });
    
    console.log("You can now scan the QR code below to send a test transaction to the contract");

    qrcode.generate(link, { small: true }, (code: any) => {
        console.log(code);
    });

    let recentAddressArchive: Address;
    let sumArchive: bigint = BigInt(0);
    
    setInterval(async () => {
        const latestBlock = await client4.getLastBlock();
        const { exitCode: sender_code, result: sender_address } = await client4.runMethod(
            latestBlock.last.seqno,
            address,
            "get_the_latest_sender",
            []
        );
        
        if (sender_code !== 0) {
            console.log("Error while running the method");
            return;
        }

        if (sender_address[0].type !== "slice") {
            console.log("Unexpected result type");
            return;
        }

        const { exitCode: sum_code, result: sum_sum } = await client4.runMethod(
            latestBlock.last.seqno,
            address,
            "get_sum",
            []
        );

        if (sum_code !== 0) {
            console.log("Error while running the method");
            return;
        }

        if (sum_sum[0].type !== "int") {
            console.log("Unexpected result type");
            return;
        }

        let mostRecentSender = sender_address[0].cell.beginParse().loadAddress();
        let sum: bigint = sum_sum[0].value;
        
        if (
            mostRecentSender &&
            (mostRecentSender.toString() !== recentAddressArchive?.toString()
                || sum !== sumArchive)
        ) {
            console.log("The most recent sender is " + mostRecentSender.toString({ testOnly: testnet ? true : false }));
            console.log("The sum is " + sum.toString());
            recentAddressArchive = mostRecentSender;
            sumArchive = sum;
        }
    }, 2000);
}

onChainTestScript();