#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short, token};

// Definimos estructuras de datos para el storage
#[contracttype]
pub enum DataKey {
    Admin,      // El Oráculo/Empresa
    Agri(Address), // Datos de cada agricultor
    Token,      // Dirección del USDC (Token)
}

#[contract]
pub struct SeguroContract;

#[contractimpl]
impl SeguroContract {
    // Inicializa el contrato con el admin y el token a usar
    pub fn inicializar(env: Env, admin: Address, token_addr: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token_addr);
    }

    // El agricultor deposita su prima de seguro
    pub fn contratar_seguro(env: Env, agricultor: Address, monto_prima: i128) {
        agricultor.require_auth();
        
        let token_client = token::Client::new(&env, &env.storage().instance().get(&DataKey::Token).unwrap());
        
        // Transferir prima del agricultor al contrato
        token_client.transfer(&agricultor, &env.current_contract_address(), &monto_prima);
        
        // Guardar que este agricultor está asegurado
        env.storage().instance().set(&DataKey::Agri(agricultor), &monto_prima);
    }

    // Solo el Admin (Oráculo) activa el pago si detecta sequía
    pub fn pagar_siniestro(env: Env, admin: Address, agricultor: Address, monto_pago: i128) {
        let almacenado_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        assert_eq!(admin, almacenado_admin, "No autorizado");

        let token_client = token::Client::new(&env, &env.storage().instance().get(&DataKey::Token).unwrap());
        
        // El contrato paga al agricultor automáticamente
        token_client.transfer(&env.current_contract_address(), &agricultor, &monto_pago);
    }
}