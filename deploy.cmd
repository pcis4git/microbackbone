oc delete buildconfig backbone
oc delete imagestream backbone
oc new-build --strategy docker --binary --name backbone
oc start-build backbone --from-dir . --follow --loglevel=8
oc delete -f k8s/deployment.yaml
oc delete -f k8s/deployment2.yaml
oc apply -f k8s/deployment.yaml
oc apply -f k8s/deployment2.yaml

oc apply -f k8s/service.yaml
oc apply -f k8s/service2.yaml
oc delete route backbone
oc apply -f k8s/route.yaml
oc delete route dummy
oc apply -f k8s/route2.yaml

