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
    pub total_released: i128,
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
#[derive(Clone, Debug)]
pub struct Milestone {
    pub id: u32,
    pub description: String,
    pub amount: i128,
    pub deadline: u64,
    pub approvals: u32,
    pub required_approvals: u32,
    pub released: bool,
    pub completed: bool,
    pub missed: bool,
    pub refunded: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proof {
    pub id: u32,
    pub milestone_id: u32,
    pub description: String,
    pub proof_hash: String,
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Campaign,
    DonorCount,
    Donation(u32),
    DonorTotal(Address),
    MilestoneCount,
    Milestone(u32),
    MilestoneApproval(u32, Address),
    TotalEscrowed,
    Token,
    MissedVote(u32, Address),
    MissedVoteCount(u32),
    ProofCount(u32),
    Proof(u32, u32),
    Refunded(u32, Address),
}

#[contract]
pub struct CrowdEscrowContract;

#[contractimpl]
impl CrowdEscrowContract {
    pub fn initialize(
        env: Env,
        owner: Address,
        goal: i128,
        deadline: u64,
        title: String,
        description: String,
        token: Address,
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
            total_released: 0,
            deadline,
            title,
            description,
        };
        env.storage().instance().set(&DataKey::Campaign, &campaign);
        env.storage().instance().set(&DataKey::DonorCount, &0u32);
        env.storage().instance().set(&DataKey::MilestoneCount, &0u32);
        env.storage().instance().set(&DataKey::TotalEscrowed, &0i128);
        env.storage().instance().set(&DataKey::Token, &token);
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

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&donor, &env.current_contract_address(), &donate_amount);

        campaign.total_raised += donate_amount;
        env.storage()
            .instance()
            .set(&DataKey::Campaign, &campaign);

        let donor_total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DonorTotal(donor.clone()))
            .unwrap_or(0);
        env.storage().instance().set(
            &DataKey::DonorTotal(donor.clone()),
            &(donor_total + donate_amount),
        );

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

    pub fn add_milestone(
        env: Env,
        description: String,
        amount: i128,
        deadline: u64,
        required_approvals: u32,
    ) -> u32 {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");
        campaign.owner.require_auth();

        assert!(amount > 0, "milestone amount must be positive");
        assert!(
            deadline > env.ledger().timestamp(),
            "milestone deadline must be in future"
        );
        assert!(required_approvals > 0, "must require at least 1 approval");

        let escrowed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalEscrowed)
            .unwrap_or(0);
        let available = campaign.total_raised - escrowed;
        assert!(available >= amount, "insufficient funds for milestone");

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MilestoneCount)
            .unwrap_or(0);
        let idx = count + 1;

        let milestone = Milestone {
            id: idx,
            description,
            amount,
            deadline,
            approvals: 0,
            required_approvals,
            released: false,
            completed: false,
            missed: false,
            refunded: 0,
        };
        env.storage()
            .instance()
            .set(&DataKey::Milestone(idx), &milestone);
        env.storage()
            .instance()
            .set(&DataKey::MilestoneCount, &idx);
        env.storage()
            .instance()
            .set(&DataKey::TotalEscrowed, &(escrowed + amount));

        env.events().publish(
            (symbol_short!("ms_add"),),
            (idx, amount, deadline),
        );

        idx
    }

    pub fn submit_proof(
        env: Env,
        milestone_id: u32,
        description: String,
        proof_hash: String,
    ) -> u32 {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");
        campaign.owner.require_auth();

        let milestone: Milestone = env
            .storage()
            .instance()
            .get(&DataKey::Milestone(milestone_id))
            .expect("milestone not found");

        assert!(!milestone.released, "milestone already released");
        assert!(!milestone.completed, "milestone already completed");
        assert!(!milestone.missed, "milestone was marked missed");
        assert!(
            !proof_hash.is_empty(),
            "proof hash must not be empty"
        );

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ProofCount(milestone_id))
            .unwrap_or(0);
        let idx = count + 1;
        let proof = Proof {
            id: idx,
            milestone_id,
            description,
            proof_hash,
            timestamp: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::Proof(milestone_id, idx), &proof);
        env.storage()
            .instance()
            .set(&DataKey::ProofCount(milestone_id), &idx);

        env.events().publish(
            (symbol_short!("proof"),),
            (milestone_id, idx, env.ledger().timestamp()),
        );

        idx
    }

    pub fn approve_milestone(env: Env, approver: Address, milestone_id: u32) {
        approver.require_auth();
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");

        assert!(
            env.storage()
                .instance()
                .has(&DataKey::Milestone(milestone_id)),
            "milestone not found"
        );

        let mut milestone: Milestone = env
            .storage()
            .instance()
            .get(&DataKey::Milestone(milestone_id))
            .expect("milestone not found");

        assert!(!milestone.released, "milestone already released");
        assert!(!milestone.completed, "milestone already completed");
        assert!(!milestone.missed, "milestone was marked missed");
        assert!(
            env.ledger().timestamp() <= milestone.deadline,
            "approval window closed"
        );

        assert!(
            approver != campaign.owner,
            "owner cannot approve own milestone"
        );

        assert!(
            !env.storage()
                .instance()
                .has(&DataKey::MilestoneApproval(milestone_id, approver.clone())),
            "already approved"
        );

        env.storage().instance().set(
            &DataKey::MilestoneApproval(milestone_id, approver),
            &true,
        );

        milestone.approvals += 1;
        if milestone.approvals >= milestone.required_approvals {
            milestone.completed = true;
        }
        env.storage()
            .instance()
            .set(&DataKey::Milestone(milestone_id), &milestone);

        env.events().publish(
            (symbol_short!("ms_appr"),),
            (milestone_id, milestone.approvals, milestone.required_approvals),
        );
    }

    pub fn vote_missed(env: Env, voter: Address, milestone_id: u32) -> u32 {
        voter.require_auth();
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");

        let mut milestone: Milestone = env
            .storage()
            .instance()
            .get(&DataKey::Milestone(milestone_id))
            .expect("milestone not found");

        assert!(!milestone.released, "milestone already released");
        assert!(!milestone.completed, "milestone already completed");
        assert!(!milestone.missed, "milestone already marked missed");
        assert!(
            env.ledger().timestamp() > milestone.deadline,
            "milestone deadline not reached"
        );
        assert!(voter != campaign.owner, "owner cannot vote");
        let donor_total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DonorTotal(voter.clone()))
            .unwrap_or(0);
        assert!(donor_total > 0, "only donors can vote");
        assert!(
            !env.storage()
                .instance()
                .has(&DataKey::MissedVote(milestone_id, voter.clone())),
            "already voted"
        );

        env.storage().instance().set(
            &DataKey::MissedVote(milestone_id, voter),
            &true,
        );

        let vote_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MissedVoteCount(milestone_id))
            .unwrap_or(0)
            + 1;
        env.storage()
            .instance()
            .set(&DataKey::MissedVoteCount(milestone_id), &vote_count);

        let donor_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::DonorCount)
            .unwrap_or(0);
        let required = donor_count / 2 + 1;
        if vote_count >= required {
            milestone.missed = true;
            env.storage()
                .instance()
                .set(&DataKey::Milestone(milestone_id), &milestone);
        }

        env.events().publish(
            (symbol_short!("ms_mis"),),
            (milestone_id, vote_count, required),
        );

        vote_count
    }

    pub fn request_refund(env: Env, backer: Address, milestone_id: u32) -> i128 {
        backer.require_auth();
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");

        let mut milestone: Milestone = env
            .storage()
            .instance()
            .get(&DataKey::Milestone(milestone_id))
            .expect("milestone not found");

        assert!(milestone.missed, "milestone not marked missed");
        assert!(!milestone.released, "milestone already released");
        assert!(
            !env.storage()
                .instance()
                .has(&DataKey::Refunded(milestone_id, backer.clone())),
            "already refunded"
        );

        let donor_total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DonorTotal(backer.clone()))
            .unwrap_or(0);
        assert!(donor_total > 0, "no donation to refund");

        let share = donor_total * milestone.amount / campaign.total_raised;
        assert!(share > 0, "refund too small");

        let remaining = milestone.amount - milestone.refunded;
        assert!(remaining >= share, "refund pool exhausted");

        env.storage()
            .instance()
            .set(&DataKey::Refunded(milestone_id, backer.clone()), &true);

        milestone.refunded += share;
        env.storage()
            .instance()
            .set(&DataKey::Milestone(milestone_id), &milestone);

        let escrowed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalEscrowed)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalEscrowed, &(escrowed - share));

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &backer, &share);

        env.events().publish(
            (symbol_short!("refund"),),
            (milestone_id, backer, share),
        );

        share
    }

    pub fn release_milestone(env: Env, milestone_id: u32) {
        let campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");
        campaign.owner.require_auth();

        let mut milestone: Milestone = env
            .storage()
            .instance()
            .get(&DataKey::Milestone(milestone_id))
            .expect("milestone not found");

        assert!(milestone.completed, "milestone not yet approved");
        assert!(!milestone.released, "already released");
        assert!(!milestone.missed, "milestone was marked missed");

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        let token_client = token::Client::new(&env, &token);
        let balance = token_client.balance(&env.current_contract_address());
        assert!(balance >= milestone.amount, "insufficient contract balance");

        token_client.transfer(
            &env.current_contract_address(),
            &campaign.owner,
            &milestone.amount,
        );

        milestone.released = true;
        env.storage()
            .instance()
            .set(&DataKey::Milestone(milestone_id), &milestone);

        let escrowed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalEscrowed)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalEscrowed, &(escrowed - milestone.amount));

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized");
        campaign.total_released += milestone.amount;
        env.storage()
            .instance()
            .set(&DataKey::Campaign, &campaign);

        env.events().publish(
            (symbol_short!("ms_rel"),),
            (milestone_id, milestone.amount),
        );
    }

    pub fn withdraw(env: Env, to: Address) -> i128 {
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

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        let token_client = token::Client::new(&env, &token);
        let balance = token_client.balance(&env.current_contract_address());
        let escrowed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalEscrowed)
            .unwrap_or(0);
        let withdrawable = balance - escrowed;
        assert!(withdrawable > 0, "no funds to withdraw");

        to.require_auth();
        token_client.transfer(&env.current_contract_address(), &to, &withdrawable);

        env.events().publish(
            (symbol_short!("wdraw"),),
            (to, withdrawable),
        );

        withdrawable
    }

    pub fn get_campaign(env: Env) -> Campaign {
        env.storage()
            .instance()
            .get(&DataKey::Campaign)
            .expect("not initialized")
    }

    pub fn get_milestone_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MilestoneCount)
            .unwrap_or(0)
    }

    pub fn get_milestone(env: Env, milestone_id: u32) -> Milestone {
        env.storage()
            .instance()
            .get(&DataKey::Milestone(milestone_id))
            .expect("milestone not found")
    }

    pub fn get_milestones(env: Env, page: u32, page_size: u32) -> Vec<Milestone> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MilestoneCount)
            .unwrap_or(0);
        let mut milestones: Vec<Milestone> = Vec::new(&env);
        let start = page * page_size;
        let end = (start + page_size).min(count);
        for i in (start + 1)..=end {
            if let Some(m) = env.storage().instance().get(&DataKey::Milestone(i)) {
                milestones.push_back(m);
            }
        }
        milestones
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

    pub fn get_total_escrowed(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalEscrowed)
            .unwrap_or(0)
    }

    pub fn get_donor_total(env: Env, donor: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DonorTotal(donor))
            .unwrap_or(0)
    }

    pub fn get_missed_vote_count(env: Env, milestone_id: u32) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::MissedVoteCount(milestone_id))
            .unwrap_or(0)
    }

    pub fn has_voted(env: Env, milestone_id: u32, voter: Address) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::MissedVote(milestone_id, voter))
    }

    pub fn has_refunded(env: Env, milestone_id: u32, backer: Address) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::Refunded(milestone_id, backer))
    }

    pub fn get_proofs(env: Env, milestone_id: u32) -> Vec<Proof> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ProofCount(milestone_id))
            .unwrap_or(0);
        let mut proofs: Vec<Proof> = Vec::new(&env);
        for i in 1..=count {
            if let Some(p) = env.storage().instance().get(&DataKey::Proof(milestone_id, i)) {
                proofs.push_back(p);
            }
        }
        proofs
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        token::StellarAssetClient,
        Env,
    };

    fn set_time(env: &Env, ts: u64) {
        env.ledger().set(LedgerInfo {
            timestamp: ts,
            protocol_version: 27,
            sequence_number: 100,
            network_id: Default::default(),
            base_reserve: 0,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 0,
        });
    }

    fn setup(
        env: &Env,
    ) -> (
        CrowdEscrowContractClient<'_>,
        Address,
        Address,
        Address,
        Address,
        Address,
        Address,
    ) {
        env.mock_all_auths();
        set_time(env, 1000);

        let owner = Address::generate(env);
        let backer1 = Address::generate(env);
        let backer2 = Address::generate(env);
        let stranger = Address::generate(env);

        let token = env.register_stellar_asset_contract(owner.clone());
        let token_admin = StellarAssetClient::new(env, &token);
        token_admin.mint(&owner, &1_000_000_000_000i128);
        token_admin.mint(&backer1, &1_000_000_000_000i128);
        token_admin.mint(&backer2, &1_000_000_000_000i128);

        let contract_addr = Address::generate(env);
        let contract_id = env.register_contract(Some(&contract_addr), CrowdEscrowContract);
        let client = CrowdEscrowContractClient::new(env, &contract_id);

        client.initialize(
            &owner,
            &10_000_000_000i128,
            &500_000u64,
            &String::from_str(env, "Campaign"),
            &String::from_str(env, "Test campaign"),
            &token,
        );

        (client, owner, backer1, backer2, stranger, token, contract_addr)
    }

    fn balance_of(env: &Env, token: &Address, addr: &Address) -> i128 {
        let token_client = token::Client::new(env, token);
        token_client.balance(addr)
    }

    #[test]
    fn test_initialize_and_donate_cap() {
        let env = Env::default();
        let (client, _owner, backer1, _backer2, _stranger, _token, _addr) = setup(&env);

        let returned = client.donate(&backer1, &20_000_000_000i128);
        assert_eq!(returned, 10_000_000_000i128);

        let campaign = client.get_campaign();
        assert_eq!(campaign.total_raised, 10_000_000_000i128);
        assert_eq!(client.get_donor_count(), 1);
        assert_eq!(client.get_donor_total(&backer1), 10_000_000_000i128);
    }

    #[test]
    #[should_panic(expected = "goal already reached")]
    fn test_donate_rejects_after_goal() {
        let env = Env::default();
        let (client, _owner, backer1, _backer2, _stranger, _token, _addr) = setup(&env);
        client.donate(&backer1, &10_000_000_000i128);
        client.donate(&backer1, &1i128);
    }

    #[test]
    fn test_milestone_approval_and_release() {
        let env = Env::default();
        let (client, owner, backer1, backer2, _stranger, token, _addr) = setup(&env);
        client.donate(&backer1, &6_000_000_000i128);
        client.donate(&backer2, &4_000_000_000i128);

        let ms_id = client.add_milestone(
            &String::from_str(&env, "Phase 1"),
            &5_000_000_000i128,
            &200_000u64,
            &2u32,
        );
        assert_eq!(ms_id, 1);
        assert_eq!(client.get_total_escrowed(), 5_000_000_000i128);

        client.approve_milestone(&backer1, &1);
        let ms = client.get_milestone(&1);
        assert!(!ms.completed);

        client.approve_milestone(&backer2, &1);
        let ms = client.get_milestone(&1);
        assert!(ms.completed);
        assert_eq!(ms.approvals, 2);

        let owner_balance_before = balance_of(&env, &token, &owner);
        client.release_milestone(&1);
        let owner_balance_after = balance_of(&env, &token, &owner);
        assert_eq!(owner_balance_after - owner_balance_before, 5_000_000_000i128);

        let ms = client.get_milestone(&1);
        assert!(ms.released);
        assert_eq!(client.get_total_escrowed(), 0);
    }

    #[test]
    fn test_withdraw_cannot_drain_escrowed_funds() {
        let env = Env::default();
        let (client, owner, backer1, _backer2, _stranger, token, contract_addr) = setup(&env);
        client.donate(&backer1, &10_000_000_000i128);

        client.add_milestone(
            &String::from_str(&env, "Escrowed phase"),
            &6_000_000_000i128,
            &200_000u64,
            &1u32,
        );
        assert_eq!(client.get_total_escrowed(), 6_000_000_000i128);

        set_time(&env, 600_000);
        let balance_before = balance_of(&env, &token, &owner);
        let withdrawn = client.withdraw(&owner);
        let balance_after = balance_of(&env, &token, &owner);

        assert_eq!(withdrawn, 4_000_000_000i128);
        assert_eq!(balance_after - balance_before, 4_000_000_000i128);
        assert_eq!(balance_of(&env, &token, &contract_addr), 6_000_000_000i128);
        assert_eq!(client.get_total_escrowed(), 6_000_000_000i128);
    }

    #[test]
    fn test_refund_flow_after_missed_milestone() {
        let env = Env::default();
        let (client, _owner, backer1, backer2, _stranger, token, _addr) = setup(&env);
        client.donate(&backer1, &4_000_000_000i128);
        client.donate(&backer2, &6_000_000_000i128);

        client.add_milestone(
            &String::from_str(&env, "Deliverable"),
            &5_000_000_000i128,
            &5_000u64,
            &2u32,
        );

        set_time(&env, 6_000);

        let votes = client.vote_missed(&backer1, &1);
        assert_eq!(votes, 1);
        let ms = client.get_milestone(&1);
        assert!(!ms.missed);

        let votes = client.vote_missed(&backer2, &1);
        assert_eq!(votes, 2);
        let ms = client.get_milestone(&1);
        assert!(ms.missed);
        assert_eq!(client.get_missed_vote_count(&1), 2);

        let b1_before = balance_of(&env, &token, &backer1);
        let share1 = client.request_refund(&backer1, &1);
        let b1_after = balance_of(&env, &token, &backer1);
        assert_eq!(share1, 2_000_000_000i128);
        assert_eq!(b1_after - b1_before, 2_000_000_000i128);
        assert!(client.has_refunded(&1, &backer1));

        let share2 = client.request_refund(&backer2, &1);
        assert_eq!(share2, 3_000_000_000i128);

        let ms = client.get_milestone(&1);
        assert_eq!(ms.refunded, 5_000_000_000i128);
        assert_eq!(client.get_total_escrowed(), 0);
    }

    #[test]
    #[should_panic(expected = "only donors can vote")]
    fn test_only_donors_can_vote_missed() {
        let env = Env::default();
        let (client, _owner, backer1, _backer2, stranger, _token, _addr) = setup(&env);
        client.donate(&backer1, &1_000_000_000i128);
        client.add_milestone(
            &String::from_str(&env, "Deliverable"),
            &500_000_000i128,
            &5_000u64,
            &1u32,
        );
        set_time(&env, 6_000);
        client.vote_missed(&stranger, &1);
    }

    #[test]
    #[should_panic(expected = "owner cannot vote")]
    fn test_owner_cannot_vote_missed() {
        let env = Env::default();
        let (client, owner, backer1, _backer2, _stranger, _token, _addr) = setup(&env);
        client.donate(&backer1, &1_000_000_000i128);
        client.add_milestone(
            &String::from_str(&env, "Deliverable"),
            &500_000_000i128,
            &5_000u64,
            &1u32,
        );
        set_time(&env, 6_000);
        client.vote_missed(&owner, &1);
    }

    #[test]
    #[should_panic(expected = "approval window closed")]
    fn test_approval_closes_after_milestone_deadline() {
        let env = Env::default();
        let (client, _owner, backer1, _backer2, _stranger, _token, _addr) = setup(&env);
        client.donate(&backer1, &1_000_000_000i128);
        client.add_milestone(
            &String::from_str(&env, "Deliverable"),
            &500_000_000i128,
            &5_000u64,
            &1u32,
        );
        set_time(&env, 6_000);
        client.approve_milestone(&backer1, &1);
    }

    #[test]
    fn test_proof_submission_and_retrieval() {
        let env = Env::default();
        let (client, _owner, backer1, _backer2, _stranger, _token, _addr) = setup(&env);
        client.donate(&backer1, &1_000_000_000i128);
        client.add_milestone(
            &String::from_str(&env, "Deliverable"),
            &500_000_000i128,
            &50_000u64,
            &1u32,
        );

        let proof_id = client.submit_proof(
            &1,
            &String::from_str(&env, "Build photo"),
            &String::from_str(&env, "abc123def456"),
        );
        assert_eq!(proof_id, 1);

        let proofs = client.get_proofs(&1);
        assert_eq!(proofs.len(), 1);
        let p = proofs.get(0).unwrap();
        assert_eq!(p.proof_hash, String::from_str(&env, "abc123def456"));
        assert_eq!(p.milestone_id, 1);
    }

    #[test]
    #[should_panic(expected = "already refunded")]
    fn test_double_refund_rejected() {
        let env = Env::default();
        let (client, _owner, backer1, backer2, _stranger, _token, _addr) = setup(&env);
        client.donate(&backer1, &4_000_000_000i128);
        client.donate(&backer2, &6_000_000_000i128);
        client.add_milestone(
            &String::from_str(&env, "Deliverable"),
            &5_000_000_000i128,
            &5_000u64,
            &2u32,
        );
        set_time(&env, 6_000);
        client.vote_missed(&backer1, &1);
        client.vote_missed(&backer2, &1);
        client.request_refund(&backer1, &1);
        client.request_refund(&backer1, &1);
    }
}
