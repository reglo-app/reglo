FROM php:8.3-cli

# gd: re-encodes uploaded profile photos (JPEG, PNG and WebP)
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libicu-dev libpq-dev libzip-dev libjpeg62-turbo-dev libpng-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install intl pdo_pgsql zip opcache gd \
    && rm -rf /var/lib/apt/lists/*

COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
EXPOSE 8000

# Development image: PHP built-in server. A production image comes later.
CMD ["sh", "-c", "composer install --no-interaction && php -S 0.0.0.0:8000 -t public"]
