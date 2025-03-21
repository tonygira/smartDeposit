import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ce code est très simple et ne doit pas être utilisé en production ! Il faut utiliser un système plus sécurisé.
 * Génère un code unique pour une propriété
 * @param seed - ID de la propriété sous forme de chaîne
 * @returns Un code unique au format XXXX-XXXX
 */
export function generateRandomCode(seed: string): string {
  const propertyId = parseInt(seed);
  if (isNaN(propertyId)) return "0000-0000";
  
  // Caractères autorisés pour le code (sans caractères ambigus)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  
  // Utiliser un nombre aléatoire basé sur l'ID de la propriété
  let code = '';
  
  // Les 2 premiers caractères encodent l'ID de propriété
  // Cette méthode simple permet de supporter jusqu'à 1024 propriétés uniques
  let encodedId = propertyId % 1024;
  const first = chars[Math.floor(encodedId / 32) % chars.length];
  const second = chars[encodedId % chars.length];
  
  // Les 6 autres caractères sont aléatoires pour la sécurité
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  
  // Format XXXX-XXXX avec l'ID encodé dans les 2 premiers caractères
  return `${first}${second}${code.substring(0, 2)}-${code.substring(2, 6)}`;
}

/**
 * Décode un code caution pour extraire l'ID de propriété
 * @param code - Le code caution au format XXXX-XXXX
 * @returns L'ID de propriété ou null si le code est invalide
 */
export function decodePropertyIdFromCode(code: string): number | null {
  if (!code || code.length !== 9 || code[4] !== '-') return null;
  
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  
  const first = code[0];
  const second = code[1];
  
  const firstIndex = chars.indexOf(first);
  const secondIndex = chars.indexOf(second);
  
  if (firstIndex === -1 || secondIndex === -1) return null;
  
  // Reconstruction de l'ID
  const propertyId = (firstIndex * 32 + secondIndex) % 1024;
  
  return propertyId;
}
