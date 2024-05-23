import { 
    Address, 
    Cell, 
    Contract, 
    ContractProvider, 
    SendMode, 
    Sender, 
    beginCell, 
    contractAddress, 
    toNano 
} from "@ton/core";

export type MainContractConfig = {
    sender_address: Address;
    initial_sum: number;
    owner_address: Address;
};

export enum Opcode {
    OP_INCREMENT = 1,
    OP_DEPOSIT = 2,
    OP_WITHDRAW = 3,
    OP_DESTROY = 4
}

export function mainContractConfigToCell(config: MainContractConfig): Cell {
    return beginCell()
        .storeAddress(config.sender_address)
        .storeUint(config.initial_sum, 32)
        .storeAddress(config.owner_address)
        .endCell();
}

export class MainContract implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell, data: Cell }
    ) {}

    static createFromConfig(config: MainContractConfig, code: Cell, workchain = 0) {
        const data = mainContractConfigToCell(config);
        const init = { code, data };
        const address = contractAddress(workchain, init);

        return new MainContract(address, init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcode.OP_DEPOSIT, 32)
                .endCell()
        });
    }

    async sendIncrementMessage(
        provider: ContractProvider,
        sender: Sender,
        number: bigint
    ) {
        await provider.internal(sender, {
            value: toNano(0.001),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcode.OP_INCREMENT, 32)
                .storeUint(number, 32)
                .endCell()
        })
    }

    async sendDepositMessage(
        provider: ContractProvider,
        sender: Sender,
        value: bigint
    ) {
        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcode.OP_DEPOSIT, 32)
                .endCell()
        })
    }

    async sendDepositWithNoOpMessage(
        provider: ContractProvider,
        sender: Sender,
        value: bigint
    ) {
        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        })
    }

    async sendWithdrawMessage(
        provider: ContractProvider,
        sender: Sender,
        value: bigint
    ) {
        await provider.internal(sender, {
            value: toNano(0.01),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcode.OP_WITHDRAW, 32)
                .storeCoins(value)
                .endCell()
        })
    }

    async sendDestroyMessage(
        provider: ContractProvider,
        sender: Sender
    ) {
        await provider.internal(sender, {
            value: toNano(0.01),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcode.OP_DESTROY, 32)
                .endCell()
        })
    }

    async getData(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get("get_contract_data", []);
        return {
            recent_sender: stack.readAddress(),
            sum: stack.readBigNumber(),
            owner: stack.readAddress()
        };
    }

    async getBalance(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get("balance", []);
        return {
            value: stack.readBigNumber()
        };
    }
}