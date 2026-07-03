$targetTime = (Get-Date -Hour 4 -Minute 35 -Second 0)
if ($targetTime -lt (Get-Date)) { $targetTime = $targetTime.AddDays(1) }
$waitTime = ($targetTime - (Get-Date)).TotalSeconds

Write-Host "Sleeping until 4:35 AM..."
Start-Sleep -Seconds $waitTime

Write-Host "Waking up Claude..."

$prompt = "We ran out of credits in the middle of M1. Please read CLAUDE.md and analyze the files you have already created in this directory to restore your context. M0 is complete. Your task is to resume and finish M1 (P1 Analysis + P2 Geometry passes). STRICT GUARDRAIL: Stop execution completely after making the local 'feat: P1+P2' commit for M1. Do not start M2. Leave the environment in a state where I can start the Vite server and manually verify the M1 acceptance criteria (specifically that 'breathing' bows the wall and 'flowWarp' makes mortar lines crawl along themselves without tearing)."

claude $prompt