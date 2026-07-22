-- Script de inicialização do PostgreSQL para garantir a existência do banco de dados do Langfuse
SELECT 'CREATE DATABASE langfuse'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'langfuse')\gexec
