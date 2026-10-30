// Identificador único local: momento da criação + sufixo aleatório (evita colisão em toques seguidos).
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
