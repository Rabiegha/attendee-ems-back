# Script de test des API Attendee Types
# Assurez-vous que le serveur est en cours d'exécution sur http://localhost:3000

$baseUrl = "http://localhost:3000"

Write-Host "=== Test des API Attendee Types ===" -ForegroundColor Green
Write-Host ""

# 1. Vérifier que le serveur est actif
Write-Host "1. Test de santé du serveur..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "✓ Serveur actif: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur: Le serveur n'est pas accessible" -ForegroundColor Red
    Write-Host "Assurez-vous que le serveur est démarré avec: npm run start:dev" -ForegroundColor Yellow
    exit
}
Write-Host ""

# 2. Connexion et obtention du token
Write-Host "2. Connexion pour obtenir un token..." -ForegroundColor Cyan
$loginBody = @{
    email = "admin@org1.com"
    password = "Password123!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.access_token
    $orgId = $loginResponse.user.org_id
    Write-Host "✓ Connexion réussie" -ForegroundColor Green
    Write-Host "  - Token obtenu: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "  - Org ID: $orgId" -ForegroundColor Gray
} catch {
    Write-Host "✗ Erreur de connexion: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Tentez avec d'autres identifiants ou vérifiez la base de données" -ForegroundColor Yellow
    exit
}
Write-Host ""

# Headers avec authentification
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 3. Lister les attendee types existants
Write-Host "3. Liste des attendee types existants..." -ForegroundColor Cyan
try {
    $existingTypes = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/attendee-types" -Method Get -Headers $headers
    Write-Host "✓ Types existants: $($existingTypes.Count)" -ForegroundColor Green
    if ($existingTypes.Count -gt 0) {
        $existingTypes | ForEach-Object {
            Write-Host "  - [$($_.code)] $($_.name) - Couleur: $($_.color_hex)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  Aucun type existant" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Erreur lors de la récupération: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 4. Créer un nouveau attendee type
Write-Host "4. Création d'un nouveau type 'VIP'..." -ForegroundColor Cyan
$newType = @{
    code = "vip"
    name = "VIP"
    color_hex = "#FFD700"
    text_color_hex = "#000000"
    icon = "star"
    sort_order = 1
} | ConvertTo-Json

try {
    $createdType = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/attendee-types" -Method Post -Body $newType -Headers $headers
    Write-Host "✓ Type créé avec succès" -ForegroundColor Green
    Write-Host "  - ID: $($createdType.id)" -ForegroundColor Gray
    Write-Host "  - Code: $($createdType.code)" -ForegroundColor Gray
    Write-Host "  - Nom: $($createdType.name)" -ForegroundColor Gray
    $vipTypeId = $createdType.id
} catch {
    Write-Host "✗ Erreur lors de la création: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -like "*already exists*") {
        Write-Host "  Le type existe déjà, récupération de l'ID existant..." -ForegroundColor Yellow
        $existingVip = $existingTypes | Where-Object { $_.code -eq "vip" } | Select-Object -First 1
        if ($existingVip) {
            $vipTypeId = $existingVip.id
            Write-Host "  ID récupéré: $vipTypeId" -ForegroundColor Gray
        }
    }
}
Write-Host ""

# 5. Créer un deuxième type "Speaker"
Write-Host "5. Création d'un type 'Speaker'..." -ForegroundColor Cyan
$speakerType = @{
    code = "speaker"
    name = "Conférencier"
    color_hex = "#4A90E2"
    text_color_hex = "#FFFFFF"
    icon = "microphone"
    sort_order = 2
} | ConvertTo-Json

try {
    $createdSpeaker = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/attendee-types" -Method Post -Body $speakerType -Headers $headers
    Write-Host "✓ Type 'Speaker' créé" -ForegroundColor Green
    $speakerTypeId = $createdSpeaker.id
} catch {
    Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -like "*already exists*") {
        $existingSpeaker = $existingTypes | Where-Object { $_.code -eq "speaker" } | Select-Object -First 1
        if ($existingSpeaker) {
            $speakerTypeId = $existingSpeaker.id
            Write-Host "  Type 'Speaker' existe déjà, ID: $speakerTypeId" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# 6. Créer un troisième type "Participant"
Write-Host "6. Création d'un type 'Participant'..." -ForegroundColor Cyan
$participantType = @{
    code = "participant"
    name = "Participant"
    color_hex = "#50C878"
    text_color_hex = "#FFFFFF"
    icon = "user"
    sort_order = 3
} | ConvertTo-Json

try {
    $createdParticipant = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/attendee-types" -Method Post -Body $participantType -Headers $headers
    Write-Host "✓ Type 'Participant' créé" -ForegroundColor Green
    $participantTypeId = $createdParticipant.id
} catch {
    Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -like "*already exists*") {
        $existingParticipant = $existingTypes | Where-Object { $_.code -eq "participant" } | Select-Object -First 1
        if ($existingParticipant) {
            $participantTypeId = $existingParticipant.id
            Write-Host "  Type 'Participant' existe déjà, ID: $participantTypeId" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# 7. Mettre à jour un type
if ($vipTypeId) {
    Write-Host "7. Mise à jour du type VIP..." -ForegroundColor Cyan
    $updateType = @{
        name = "VIP Premium"
        color_hex = "#FF6B35"
    } | ConvertTo-Json

    try {
        $updatedType = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/attendee-types/$vipTypeId" -Method Patch -Body $updateType -Headers $headers
        Write-Host "✓ Type mis à jour" -ForegroundColor Green
        Write-Host "  - Nouveau nom: $($updatedType.name)" -ForegroundColor Gray
        Write-Host "  - Nouvelle couleur: $($updatedType.color_hex)" -ForegroundColor Gray
    } catch {
        Write-Host "✗ Erreur lors de la mise à jour: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

# 8. Lister tous les événements pour en sélectionner un
Write-Host "8. Récupération d'un événement pour tester la configuration..." -ForegroundColor Cyan
try {
    $events = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/events" -Method Get -Headers $headers
    if ($events.data.Count -gt 0) {
        $event = $events.data[0]
        $eventId = $event.id
        Write-Host "✓ Événement trouvé: $($event.name)" -ForegroundColor Green
        Write-Host "  - Event ID: $eventId" -ForegroundColor Gray
    } else {
        Write-Host "  Aucun événement disponible pour les tests" -ForegroundColor Yellow
        $eventId = $null
    }
} catch {
    Write-Host "✗ Erreur lors de la récupération des événements: $($_.Exception.Message)" -ForegroundColor Red
    $eventId = $null
}
Write-Host ""

# Tests sur l'événement si disponible
if ($eventId -and $vipTypeId) {
    # 9. Lister les types d'attendee pour l'événement
    Write-Host "9. Liste des types d'attendee pour l'événement..." -ForegroundColor Cyan
    try {
        $eventTypes = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/events/$eventId/attendee-types" -Method Get -Headers $headers
        Write-Host "✓ Types configurés pour l'événement: $($eventTypes.Count)" -ForegroundColor Green
        $eventTypes | ForEach-Object {
            Write-Host "  - $($_.attendeeType.name) - Capacité: $($_.capacity)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""

    # 10. Ajouter un type à l'événement
    Write-Host "10. Ajout du type VIP à l'événement..." -ForegroundColor Cyan
    $addTypeBody = @{
        attendeeTypeId = $vipTypeId
    } | ConvertTo-Json

    try {
        $addedType = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/events/$eventId/attendee-types" -Method Post -Body $addTypeBody -Headers $headers
        Write-Host "✓ Type ajouté à l'événement" -ForegroundColor Green
        Write-Host "  - Type: $($addedType.attendeeType.name)" -ForegroundColor Gray
        $eventTypeId = $addedType.id
    } catch {
        Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Message -like "*already added*") {
            Write-Host "  Le type est déjà configuré pour cet événement" -ForegroundColor Yellow
            # Récupérer l'ID existant
            $existingEventType = $eventTypes | Where-Object { $_.attendee_type_id -eq $vipTypeId } | Select-Object -First 1
            if ($existingEventType) {
                $eventTypeId = $existingEventType.id
            }
        }
    }
    Write-Host ""

    # 11. Mettre à jour la configuration du type pour l'événement
    if ($eventTypeId) {
        Write-Host "11. Mise à jour de la configuration du type pour l'événement..." -ForegroundColor Cyan
        $updateEventType = @{
            capacity = 50
            color_hex = "#9B59B6"
            text_color_hex = "#FFFFFF"
        } | ConvertTo-Json

        try {
            $updatedEventType = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/events/$eventId/attendee-types/$eventTypeId" -Method Put -Body $updateEventType -Headers $headers
            Write-Host "✓ Configuration mise à jour" -ForegroundColor Green
            Write-Host "  - Capacité: $($updatedEventType.capacity)" -ForegroundColor Gray
            Write-Host "  - Couleur personnalisée: $($updatedEventType.color_hex)" -ForegroundColor Gray
        } catch {
            Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        }
        Write-Host ""
    }

    # 12. Vérifier la liste mise à jour
    Write-Host "12. Vérification de la liste mise à jour..." -ForegroundColor Cyan
    try {
        $updatedEventTypes = Invoke-RestMethod -Uri "$baseUrl/orgs/$orgId/events/$eventId/attendee-types" -Method Get -Headers $headers
        Write-Host "✓ Liste mise à jour:" -ForegroundColor Green
        $updatedEventTypes | ForEach-Object {
            $colorInfo = if ($_.color_hex) { " (Couleur custom: $($_.color_hex))" } else { " (Couleur par défaut: $($_.attendeeType.color_hex))" }
            Write-Host "  - $($_.attendeeType.name) - Capacité: $($_.capacity)$colorInfo" -ForegroundColor Gray
        }
    } catch {
        Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "=== Tests terminés ===" -ForegroundColor Green
Write-Host ""
Write-Host "Résumé des endpoints testés:" -ForegroundColor Cyan
Write-Host "  GET    /orgs/:orgId/attendee-types" -ForegroundColor Gray
Write-Host "  POST   /orgs/:orgId/attendee-types" -ForegroundColor Gray
Write-Host "  PATCH  /orgs/:orgId/attendee-types/:id" -ForegroundColor Gray
Write-Host "  GET    /orgs/:orgId/events/:eventId/attendee-types" -ForegroundColor Gray
Write-Host "  POST   /orgs/:orgId/events/:eventId/attendee-types" -ForegroundColor Gray
Write-Host "  PUT    /orgs/:orgId/events/:eventId/attendee-types/:typeId" -ForegroundColor Gray
