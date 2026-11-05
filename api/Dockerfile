# Imagem de produção da API. Build: docker build -t descartaai-api api/
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY DescartaAi.Api/DescartaAi.Api.csproj DescartaAi.Api/
RUN dotnet restore DescartaAi.Api/DescartaAi.Api.csproj
COPY DescartaAi.Api/ DescartaAi.Api/
RUN dotnet publish DescartaAi.Api/DescartaAi.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_CLI_TELEMETRY_OPTOUT=1
EXPOSE 8080
# Usuário sem privilégios, já presente na imagem oficial.
USER $APP_UID
ENTRYPOINT ["dotnet", "DescartaAi.Api.dll"]
