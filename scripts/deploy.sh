#!/bin/bash

# Script de déploiement pour api.attendee.fr
# Ce script configure automatiquement nginx avec SSL Let's Encrypt

set -e

# Configuration
DOMAIN="api.attendee.fr"
EMAIL="votre-email@example.com"  # À modifier avec votre email
PROJECT_DIR="/path/to/your/project"  # À modifier avec le chemin de votre projet

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérification des prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    log_info "Prérequis OK"
}

# Création des répertoires nécessaires
create_directories() {
    log_info "Création des répertoires..."
    mkdir -p certbot/www
    mkdir -p certbot/conf
    mkdir -p nginx/logs
}

# Configuration initiale sans SSL
setup_initial_nginx() {
    log_info "Configuration nginx initiale (sans SSL)..."
    
    # Créer une configuration temporaire sans SSL
    cat > nginx/nginx-init.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name api.attendee.fr;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            proxy_pass http://api:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
}

# Démarrage des services sans SSL
start_services_without_ssl() {
    log_info "Démarrage des services sans SSL..."
    
    # Modifier temporairement docker-compose pour utiliser la config sans SSL
    cp docker-compose.prod.yml docker-compose.prod.yml.backup
    
    # Créer un docker-compose temporaire
    cat > docker-compose.temp.yml << 'EOF'
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ems
      TZ: Europe/Paris
    volumes:
      - ems_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ems"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - app-network

  api:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    environment:
      RUN_MIGRATIONS: "true"
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: ems_nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx-init.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - api
    networks:
      - app-network
    restart: unless-stopped

volumes:
  ems_pgdata:

networks:
  app-network:
    driver: bridge
EOF

    docker-compose -f docker-compose.temp.yml up -d
    
    # Attendre que nginx soit prêt
    log_info "Attente du démarrage de nginx..."
    sleep 10
}

# Obtention du certificat SSL
obtain_ssl_certificate() {
    log_info "Obtention du certificat SSL Let's Encrypt..."
    
    # Vérifier que le domaine pointe vers ce serveur
    log_warn "Assurez-vous que $DOMAIN pointe vers l'IP de ce serveur"
    read -p "Appuyez sur Entrée pour continuer..."
    
    # Obtenir le certificat
    docker run --rm \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        certbot/certbot \
        certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN
    
    if [ $? -eq 0 ]; then
        log_info "Certificat SSL obtenu avec succès"
    else
        log_error "Échec de l'obtention du certificat SSL"
        exit 1
    fi
}

# Déploiement final avec SSL
deploy_with_ssl() {
    log_info "Déploiement final avec SSL..."
    
    # Arrêter les services temporaires
    docker-compose -f docker-compose.temp.yml down
    
    # Restaurer la configuration originale
    mv docker-compose.prod.yml.backup docker-compose.prod.yml
    
    # Mettre à jour l'email dans docker-compose.prod.yml
    sed -i "s/rabiigha@gmail.com/$EMAIL/g" docker-compose.prod.yml
    
    # Démarrer avec la configuration complète
    docker-compose -f docker-compose.prod.yml up -d
    
    log_info "Déploiement terminé avec succès!"
}

# Configuration du renouvellement automatique
setup_ssl_renewal() {
    log_info "Configuration du renouvellement automatique SSL..."
    
    # Créer le script de renouvellement
    cat > renew-ssl.sh << 'EOF'
#!/bin/bash
docker run --rm \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    certbot/certbot \
    renew --webroot --webroot-path=/var/www/certbot

# Recharger nginx si le certificat a été renouvelé
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
EOF
    
    chmod +x renew-ssl.sh
    
    log_info "Script de renouvellement créé: renew-ssl.sh"
    log_info "Ajoutez cette ligne à votre crontab pour un renouvellement automatique:"
    log_info "0 12 * * * cd $PROJECT_DIR && ./renew-ssl.sh"
}

# Vérification du déploiement
verify_deployment() {
    log_info "Vérification du déploiement..."
    
    # Vérifier que les services sont en cours d'exécution
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_info "Services Docker en cours d'exécution ✓"
    else
        log_error "Problème avec les services Docker"
        return 1
    fi
    
    # Vérifier la connectivité HTTP
    if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN | grep -q "200\|301\|302"; then
        log_info "Connectivité HTTP OK ✓"
    else
        log_warn "Problème de connectivité HTTP"
    fi
    
    # Vérifier la connectivité HTTPS
    if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200"; then
        log_info "Connectivité HTTPS OK ✓"
    else
        log_warn "Problème de connectivité HTTPS"
    fi
    
    log_info "Votre API est maintenant accessible sur: https://$DOMAIN"
}

# Menu principal
main() {
    log_info "=== Déploiement de l'API Attendee ==="
    log_info "Domaine: $DOMAIN"
    log_info "Email: $EMAIL"
    echo
    
    case "${1:-full}" in
        "check")
            check_prerequisites
            ;;
        "ssl-only")
            obtain_ssl_certificate
            deploy_with_ssl
            ;;
        "full")
            check_prerequisites
            create_directories
            setup_initial_nginx
            start_services_without_ssl
            obtain_ssl_certificate
            deploy_with_ssl
            setup_ssl_renewal
            verify_deployment
            ;;
        *)
            echo "Usage: $0 [check|ssl-only|full]"
            echo "  check    - Vérifier les prérequis uniquement"
            echo "  ssl-only - Obtenir SSL et redéployer (si déjà déployé sans SSL)"
            echo "  full     - Déploiement complet (par défaut)"
            exit 1
            ;;
    esac
}

# Exécution
main "$@"
