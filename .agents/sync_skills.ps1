# Recopie .agents/skills (la source, lue par Antigravity) vers .claude/skills (lue par Claude Code).
# A lancer apres toute modification d'un skill : .\.agents\sync_skills.ps1

$racine = Split-Path -Parent $PSScriptRoot
$source = Join-Path $racine ".agents\skills"
$copie = Join-Path $racine ".claude\skills"

robocopy $source $copie /MIR /NJH /NJS /NDL /NFL | Out-Null

# robocopy : 0 a 7 = succes (rien a copier, fichiers copies, fichiers en trop retires), 8 et plus = echec.
if ($LASTEXITCODE -ge 8) {
    Write-Error "La copie des skills a echoue (robocopy $LASTEXITCODE)."
    exit 1
}

Write-Output "Skills synchronises : $((Get-ChildItem $copie -Directory).Name -join ', ')"
exit 0
