import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Capturamos el ID que mande la app (puede ser 'id' o 'deviceid')
    const deviceId = req.query.id || req.query.deviceid;
    const lat = req.query.lat;
    const lon = req.query.lon || req.query.lng;

    if (!deviceId || !lat || !lon) {
        return res.status(200).json({ msg: "Esperando datos reales del GPS..." });
    }

    const supabase = createClient(
        "https://trdfieobkewwjhzxwpxc.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZGZpZW9ia2V3d2poenh3cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODYyMTAsImV4cCI6MjA4ODQ2MjIxMH0.aU6dMbELmJRAVmdGVqkHwy60Mth8jaGkeaHVjrGqRZk"
    );

    // USAMOS UPSERT: Si el chofer no existe, lo crea. Si existe, lo actualiza.
    // IMPORTANTE: Forzamos el ID a ser 1 para que tu mapa lo encuentre siempre.
    const { error } = await supabase
        .from('rastreo_chofer')
        .upsert({ 
            id: 1, 
            lat: parseFloat(lat), 
            lng: parseFloat(lon), 
            actualizado_en: new Date() 
        });

    if (error) return res.status(500).json({ error: error.message });
    
    res.status(200).send("ok");
}
