import { supabase } from '../lib/supabaseClient'
import { cache } from '../lib/cache'
import type { Conversation } from '../lib/database'

export async function fetchUserConversations(userId: string): Promise<Conversation[]> {
  // Intentar obtener del caché primero
  const cachedConversations = cache.get('conversations', userId)
  if (cachedConversations) {
    return cachedConversations
  }

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return []
    }

    // Guardar en caché con expiración de 30 segundos
    cache.set('conversations', userId, data)
    return data
  } catch (error) {
    console.error('Error in fetchUserConversations:', error)
    return []
  }
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
  try {
    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Error updating conversation:', error)
    }

    // Invalidar caché para forzar recarga
    cache.invalidate('conversations', updates.user_id!)
  } catch (error) {
    console.error('Error in updateConversation:', error)
  }
}

export function invalidateConversationsCache(userId: string): void {
  cache.invalidate('conversations', userId)
} 