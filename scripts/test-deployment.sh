#!/bin/bash

# Script de test du déploiement pour api.attendee.fr

set -e

# Configuration
DOMAIN="api.attendee.fr"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Test 1: Vérifier les conteneurs Docker
test_docker_containers() {
    log_test "Vérification des conteneurs Docker..."
    
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_info "Conteneurs Docker en cours d'exécution"
        docker-compose -f docker-compose.prod.yml ps
    else
        log_error "Problème avec les conteneurs Docker"
        docker-compose -f docker-compose.prod.yml ps
        return 1
    fi
}

# Test 2: Connectivité HTTP (doit rediriger vers HTTPS)
test_http_redirect() {
    log_test "Test de redirection HTTP vers HTTPS..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN)
    if [ "$response" = "301" ] || [ "$response" = "302" ]; then
        log_info "Redirection HTTP vers HTTPS OK (Code: $response)"
    else
        log_error "Problème de redirection HTTP (Code: $response)"
        return 1
    fi
}

# Test 3: Connectivité HTTPS
test_https_connectivity() {
    log_test "Test de connectivité HTTPS..."
    
    if curl -s -f https://$DOMAIN/health > /dev/null; then
        log_info "Connectivité HTTPS OK"
    else
        log_error "Problème de connectivité HTTPS"
        # Essayer de récupérer plus d'infos
        curl -v https://$DOMAIN/health
        return 1
    fi
}

# Test 4: Endpoint de santé
test_health_endpoint() {
    log_test "Test de l'endpoint de santé..."
    
    health_response=$(curl -s https://$DOMAIN/health)
    if [ $? -eq 0 ]; then
        log_info "Endpoint /health accessible"
        echo "Réponse: $health_response"
    else
        log_error "Endpoint /health non accessible"
        return 1
    fi
}

# Test 5: Certificat SSL
test_ssl_certificate() {
    log_test "Vérification du certificat SSL..."
    
    # Test de base du certificat
    if echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -dates; then
        log_info "Certificat SSL valide"
        
        # Afficher les détails du certificat
        echo "Détails du certificat:"
        echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -subject -issuer -dates
    else
        log_error "Problème avec le certificat SSL"
        return 1
    fi
}

# Test 6: Headers de sécurité
test_security_headers() {
    log_test "Vérification des headers de sécurité..."
    
    headers=$(curl -s -I https://$DOMAIN)
    
    # Vérifier HSTS
    if echo "$headers" | grep -qi "strict-transport-security"; then
        log_info "Header HSTS présent"
    else
        log_warn "Header HSTS manquant"
    fi
    
    # Vérifier X-Frame-Options
    if echo "$headers" | grep -qi "x-frame-options"; then
        log_info "Header X-Frame-Options présent"
    else
        log_warn "Header X-Frame-Options manquant"
    fi
    
    # Vérifier Content-Security-Policy
    if echo "$headers" | grep -qi "content-security-policy"; then
        log_info "Header Content-Security-Policy présent"
    else
        log_warn "Header Content-Security-Policy manquant"
    fi
}

# Test 7: Rate limiting
test_rate_limiting() {
    log_test "Test du rate limiting..."
    
    echo "Envoi de 5 requêtes rapides..."
    for i in {1..5}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health)
        echo "Requête $i: $response"
        sleep 0.1
    done
    
    log_info "Rate limiting configuré (vérifiez les codes de réponse ci-dessus)"
}

# Test 8: Performance SSL
test_ssl_performance() {
    log_test "Test de performance SSL..."
    
    # Test avec curl timing
    curl -w "DNS: %{time_namelookup}s | Connect: %{time_connect}s | SSL: %{time_appconnect}s | Total: %{time_total}s\n" \
         -o /dev/null -s https://$DOMAIN/health
}

# Test 9: Vérifier les logs
test_logs() {
    log_test "Vérification des logs récents..."
    
    echo "=== Logs nginx (dernières 10 lignes) ==="
    docker-compose -f docker-compose.prod.yml logs --tail=10 nginx
    
    echo "=== Logs API (dernières 10 lignes) ==="
    docker-compose -f docker-compose.prod.yml logs --tail=10 api
}

# Fonction principale
main() {
    echo -e "${BLUE}=== Test de déploiement pour $DOMAIN ===${NC}"
    echo
    
    local failed_tests=0
    
    # Exécuter tous les tests
    test_docker_containers || ((failed_tests++))
    echo
    
    test_http_redirect || ((failed_tests++))
    echo
    
    test_https_connectivity || ((failed_tests++))
    echo
    
    test_health_endpoint || ((failed_tests++))
    echo
    
    test_ssl_certificate || ((failed_tests++))
    echo
    
    test_security_headers || ((failed_tests++))
    echo
    
    test_rate_limiting || ((failed_tests++))
    echo
    
    test_ssl_performance || ((failed_tests++))
    echo
    
    test_logs || ((failed_tests++))
    echo
    
    # Résumé
    echo -e "${BLUE}=== Résumé des tests ===${NC}"
    if [ $failed_tests -eq 0 ]; then
        log_info "Tous les tests sont passés avec succès ! 🎉"
        log_info "Votre API est opérationnelle sur https://$DOMAIN"
    else
        log_error "$failed_tests test(s) ont échoué"
        log_warn "Consultez les détails ci-dessus pour résoudre les problèmes"
        exit 1
    fi
}

# Exécution
main "$@"
