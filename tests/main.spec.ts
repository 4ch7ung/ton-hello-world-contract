import { Cell, Address, toNano } from "@ton/core";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { MainContract } from "../wrappers/MainContract";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";

describe("main.fc contract tests", () => {
    let blockchain: Blockchain;
    let codeCell: Cell;
    let initAddress: SandboxContract<TreasuryContract>;
    let ownerWallet: SandboxContract<TreasuryContract>;
    let myContract: SandboxContract<MainContract>;
    let senderWallet: SandboxContract<TreasuryContract>;

    beforeAll(async () => {
        codeCell = await compile("MainContract");
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        initAddress = await blockchain.treasury("init");
        ownerWallet = await blockchain.treasury("owner");
        myContract = blockchain.openContract(
            await MainContract.createFromConfig({
                sender_address: initAddress.address,
                initial_sum: 0,
                owner_address: ownerWallet.address
            }, codeCell)
        );
        senderWallet = await blockchain.treasury("sender");
    });

    it("should get proper recent sender address", async () => {
        // when
        const sentMessageResult = await myContract.sendIncrementMessage(
            senderWallet.getSender(),
            BigInt(1)
        );

        // then
        expect(sentMessageResult.transactions).toHaveTransaction({
            from: senderWallet.address,
            to: myContract.address,
            success: true
        });

        const data = await myContract.getData();

        expect(data.recent_sender.toString()).toBe(senderWallet.address.toString());
    });

    it("should get proper sum", async () => {
        // when
        const sentMessageResult = await myContract.sendIncrementMessage(
            senderWallet.getSender(),
            BigInt(1)
        );

        // then
        const data = await myContract.getData();

        expect(data.sum).toBe(BigInt(1));
    });

    it("should get proper sum after multiple transactions", async () => {
        // when
        await myContract.sendIncrementMessage(
            senderWallet.getSender(),
            BigInt(1)
        );

        await myContract.sendIncrementMessage(
            senderWallet.getSender(),
            BigInt(2)
        );

        // then
        const data = await myContract.getData();

        expect(data.sum).toBe(BigInt(3));
    });

    it('should deposit to the contract', async () => {

        // when
        const sentMessageResult = await myContract.sendDepositMessage(
            senderWallet.getSender(),
            toNano(5)
        );

        // then
        expect(sentMessageResult.transactions).toHaveTransaction({
            from: senderWallet.address,
            to: myContract.address,
            success: true
        });

        const newBalance = await myContract.getBalance();

        expect(newBalance.value).toBeGreaterThanOrEqual(toNano(4.99));
    });

    it('should failt to deposit without opcode', async () => {
        
        // when
        const sentMessageResult = await myContract.sendDepositWithNoOpMessage(
            senderWallet.getSender(),
            toNano(5)
        );

        // then
        expect(sentMessageResult.transactions).toHaveTransaction({
            from: senderWallet.address,
            to: myContract.address,
            success: false
        });

        const newBalance = await myContract.getBalance();

        expect(newBalance.value).toBe(toNano(0));
    });

    it('should withdraw from the contract', async () => {

        // given
        await myContract.sendDepositMessage(
            senderWallet.getSender(),
            toNano(5)
        );

        // when

        const sentMessageResult = await myContract.sendWithdrawMessage(
            ownerWallet.getSender(),
            toNano(4)
        );

        // then
        expect(sentMessageResult.transactions).toHaveTransaction({
            from: ownerWallet.address,
            to: myContract.address,
            success: true
        });

        expect(sentMessageResult.transactions).toHaveTransaction({
            from: myContract.address,
            to: ownerWallet.address,
            success: true,
            value: toNano(4)
        });

        const newBalance = await myContract.getBalance();

        expect(newBalance.value).toBeLessThan(toNano(1.01))
        expect(newBalance.value).toBeGreaterThanOrEqual(toNano(1));
    });

    it('should fail to withdraw more than the balance', async () => {
        
        // given
        await myContract.sendDepositMessage(
            senderWallet.getSender(),
            toNano(5)
        );

        // when
        const sentMessageResult = await myContract.sendWithdrawMessage(
            ownerWallet.getSender(),
            toNano(6)
        );

        // then
        expect(sentMessageResult.transactions).toHaveTransaction({
            from: ownerWallet.address,
            to: myContract.address,
            success: false,
            exitCode: 104
        });

        const newBalance = await myContract.getBalance();

        expect(newBalance.value).toBeGreaterThanOrEqual(toNano(4.99));
    });

    it('should fail to withdraw for non-owner', async () => {
        
        // given
        await myContract.sendDepositMessage(
            senderWallet.getSender(),
            toNano(5)
        );

        // when
        const sentMessageResult = await myContract.sendWithdrawMessage(
            senderWallet.getSender(),
            toNano(4)
        );

        // then
        expect(sentMessageResult.transactions).toHaveTransaction({
            from: senderWallet.address,
            to: myContract.address,
            success: false,
            exitCode: 103
        });

        const newBalance = await myContract.getBalance();

        expect(newBalance.value).toBeGreaterThanOrEqual(toNano(4.99));
    });

    it('should destroy the contract', async () => {

        // when
        const sentMessageResult = await myContract.sendDestroyMessage(
            ownerWallet.getSender()
        );

        // then
        expect(sentMessageResult.transactions).toHaveTransaction({
            from: ownerWallet.address,
            to: myContract.address,
            success: true
        });
    });
})
