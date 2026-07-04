#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    pub owner: Address,
    pub goal: i128,
    pub total_raised: i128,
    pub deadline: u64,
    pub title: String,
    pub description: String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DonorInfo {
    pub donor: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Campaign,
    DonorCount,
    Donation(u32),
}

const NATIVE_TOKEN: &str = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    pub fn initialize(
        env: Env,
        owner: Address,
        goal: i128,
        deadline: u64,
        title: String,
        description: String,
    ) {
        assert!(
            !env.storage().instance().has(&DataKey::Campaign),
            "already initialized"
        );
        assert!(goal > 0, "goal must be positive");
        assert!(
            deadline > env.ledger().timestamp(),
            "deadline must be in the future"
        );

        let campaign = Campaign {
            owner,
            goal,
            total_raised: 0,
            deadline,
            title,
            description,
        };
        env.storage().instance().set(&DataKey::Campaign, &campaign);
        env.storage().instance().set(&DataKey::DonorCount, &0u32);
    }

    pub fn donate(env: Env, donor: Address, amount: i128) -> i128 {
        donor.require_auth();
        assert!(amount > 0, "amount must be positive");

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");

        assert!(
            env.ledger().timestamp() < campaign.deadline,
            "campaign has ended"
        );
        assert!(
            campaign.total_raised < campaign.goal,
            "goal already reached"
        );

        let remaining = campaign.goal - campaign.total_raised;
        let donate_amount = if amount > remaining { remaining } else { amount };

        campaign.total_raised += donate_amount;
        env.storage()
            .instance()
            .set(&DataKey::Campaign, &campaign);

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::DonorCount)
            .unwrap_or(0);
        let idx = count + 1;
        let donor_info = DonorInfo {
            donor: donor.clone(),
            amount: donate_amount,
            timestamp: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::Donation(idx), &donor_info);
        env.storage()
            .instance()
            .set(&DataKey::DonorCount, &idx);

        env.events().publish(
            (symbol_short!("donation"),),
            (donor, donate_amount, env.ledger().timestamp()),
        );

        donate_amount
    }

    pub fn get_campaign(env: Env) -> Campaign {
        env.storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized")
    }

    pub fn get_donor_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::DonorCount)
            .unwrap_or(0)
    }

    pub fn get_donors(env: Env, page: u32, page_size: u32) -> Vec<DonorInfo> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::DonorCount)
            .unwrap_or(0);
        let mut donors: Vec<DonorInfo> = Vec::new(&env);
        let start = page * page_size;
        let end = (start + page_size).min(count);
        for i in (start + 1)..=end {
            if let Some(d) = env.storage().instance().get(&DataKey::Donation(i)) {
                donors.push_back(d);
            }
        }
        donors
    }

    pub fn withdraw(env: Env, to: Address) {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");

        campaign.owner.require_auth();

        assert!(
            env.ledger().timestamp() >= campaign.deadline
                || campaign.total_raised >= campaign.goal,
            "campaign not yet ended or goal not reached"
        );

        let native = Address::from_string(&String::from_str(&env, NATIVE_TOKEN));
        let token = token::Client::new(&env, &native);
        let balance = token.balance(&env.current_contract_address());
        assert!(balance > 0, "no funds to withdraw");

        to.require_auth();
        token.transfer(&env.current_contract_address(), &to, &balance);
    }
}
