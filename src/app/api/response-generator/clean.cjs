const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const envFile = fs.readFileSync('.env.local', 'utf8')
const getEnv = (k) => envFile.match(new RegExp(k+'=(.*)'))?.[1]?.replace(/["'\r]/g,'').trim()
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

;(async () => {
  const { data: docs } = await supabase.from('documents').select('id,file_name').ilike('file_name','%invoice2544627441%')
  for (const d of docs) {
    const { data: chunks } = await supabase.from('chunks').select('id,content').eq('document_id', d.id)
    const junk = chunks?.filter(c => c.content.includes('%PDF') || c.content.includes('endobj') || c.content.includes('%%EOF')) || []
    if (junk.length) {
      console.log(`Deleting ${junk.length} junk chunks from ${d.id}`)
      await supabase.from('chunks').delete().in('id', junk.map(j=>j.id))
    }
    if ((chunks?.length||0) === 0) {
      console.log(`Deleting empty document ${d.id} ${d.file_name}`)
      await supabase.from('documents').delete().eq('id', d.id)
    }
  }
  console.log('CLEAN DONE')
})()