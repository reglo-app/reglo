<?php

// Mounted in Adminer's plugins-enabled/ folder (see docker-compose.yml).
// The "Server" field of the login form becomes a drop-down with these two
// databases, and Adminer refuses to connect anywhere else.
require_once 'plugins/login-servers.php';

return new AdminerLoginServers([
    'Preprod' => ['server' => 'reglo-preprod-db-1', 'driver' => 'pgsql'],
    'Prod' => ['server' => 'reglo-prod-db-1', 'driver' => 'pgsql'],
]);
