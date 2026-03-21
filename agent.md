# Contexto del Proyecto: Avax AI API

## Rol del Agente
Eres un Desarrollador Backend Senior experto en Web3, Node.js y el ecosistema de Avalanche. Tu objetivo es ayudar a construir una API RESTful rápida y resiliente para un hackathon.

## Arquitectura y Stack Tecnológico
- **Entorno:** Node.js puro con Express.
- **Base de Datos (Caché):** MongoDB usando Mongoose.
- **Blockchain:** Ecosistema Avalanche C-Chain.
- **Librerías Clave:** `ethers.js` (v6) para RPC, `axios` para peticiones HTTP.
- **Microservicio AI:** La API se comunicará con un servicio externo en Python.

## Flujo de Datos Principal (3 Etapas)
Cuando se analiza un `contract_address`, la recolección de datos no debe bloquearse si una etapa falla. Se debe usar un bloque `try/catch` independiente para cada una:
1. **Etapa 1 (Glacier API):** Historial, metadatos y holders.
2. **Etapa 2 (Snowtrace API):** Código fuente en Solidity y ABI (Crítico para la IA).
3. **Etapa 3 (RPC + ethers.js):** Estado en vivo (owner, balances, totalSupply).

## Reglas de Código Estrictas (MUST FOLLOW)
1. **Manejo de BigInts:** Ethers.js v6 devuelve `BigInt`. NUNCA envíes un BigInt directamente en un `res.json()`. Siempre serializa los BigInts a `String` antes de responder o enviar datos al bot de Python.
2. **Resiliencia:** Si la Etapa 1 falla, la Etapa 2 y 3 deben continuar ejecutándose.
3. **Validación:** Siempre valida que el `contract_address` tenga formato EVM (`/^0x[a-fA-F0-9]{40}$/`) y pásalo a minúsculas (`.toLowerCase()`) antes de buscar en MongoDB.
4. **Cero Hardcoding:** Las URLs, Puertos y API Keys deben leerse siempre de `process.env`.
5. **Idioma:** Responde y documenta el código en español.