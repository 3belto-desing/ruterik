import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const { id, lat, lon } = req.query;
    const supabase = createClient(
        "https://trdfieobkewwjhzxwpxc.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZGZpZW9ia2V3d2poenh3cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODYyMTAsImV4cCI6MjA4ODQ2MjIxMH0.aU6dMbELmJRAVmdGVqkHwy60Mth8jaGkeaHVjrGqRZk"
    );

    if (id && lat && lon) {
        await supabase.from('rastreo_chofer')
            .update({ lat: parseFloat(lat), lng: parseFloat(lon), actualizado_en: new Date() })
            .eq('id', id);
    }
    res.status(200).send("ok");
}
