import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Traccar a veces usa 'id' y otras 'deviceid', vamos a aceptar ambos
    const deviceId = req.query.id || req.query.deviceid;
    const lat = req.query.lat;
    const lon = req.query.lon;

    if (!deviceId || !lat || !lon) {
        return res.status(200).json({ status: "Esperando datos", modo: "Osman/Traccar" });
    }

    const supabase = createClient(
        "https://trdfieobkewwjhzxwpxc.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZGZpZW9ia2V3d2poenh3cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODYyMTAsImV4cCI6MjA4ODQ2MjIxMH0.aU6dMbELmJRAVmdGVqkHwy60Mth8jaGkeaHVjrGqRZk"
    );

    // USAMOS 'UPSERT': Si el ID existe lo actualiza, si no existe lo CREA.
    const { error } = await supabase
        .from('rastreo_chofer')
        .upsert({ 
            id: parseInt(deviceId), 
            lat: parseFloat(lat), 
            lng: parseFloat(lon), 
            actualizado_en: new Date() 
        }, { onConflict: 'id' });

    if (error) {
        console.error("Error de Supabase:", error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).send("ok");
}
