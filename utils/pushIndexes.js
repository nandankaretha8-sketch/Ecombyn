export async function fixPushSubscriptionIndexes(PushSubscriptionModel){
    // Drop any legacy compound index on { userId, subscription.endpoint }
    try {
        const indexes = await PushSubscriptionModel.collection.indexes();
        for (const idx of indexes) {
            const keys = Object.keys(idx.key || {});
            if (keys.includes('userId') && keys.includes('subscription.endpoint')) {
                await PushSubscriptionModel.collection.dropIndex(idx.name);
            }
        }
    } catch {}

    // Ensure a unique index on endpoint only
    try {
        await PushSubscriptionModel.collection.createIndex({ 'subscription.endpoint': 1 }, { unique: true, sparse: true });
    } catch {}
}


